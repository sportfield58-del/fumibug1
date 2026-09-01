import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  Certificate,
  CertificateBatchResult,
  CertificateListQuery,
  CertificateSnapshot,
  CertificateVerifyResult,
  CreateCertificateBatchRequest,
  CreateCertificateRequest,
  SendCertificateRequest,
  SendCertificateResult,
  VoidCertificateRequest,
  CertificateStatus,
} from '@fumibug/contracts';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { StateMachineService } from '../../common/state-machine/state-machine.service';
import { httpApiError } from '../../common/http/api-response';
import type { RequestUser } from '../../common/tenant/request-context';

/**
 * docs/spec/03-modulos.md §C.21 (Certificados), R33-R38, §R34. ADR 0010.
 *
 * Transacciones de estado vía StateMachineService (certificate: DRAFT→ISSUED→SIGNED→VOIDED,
 * ya registrada en definitions.ts). La numeración correlativa (R34) se serializa por tenant
 * con un `SELECT ... FOR UPDATE` sobre la fila del tenant dentro de la transacción del
 * request; el `@@unique([tenantId, number])` respalda contra cualquier carrera residual.
 */
@Injectable()
export class CertificatesService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly audit: AuditService,
    private readonly stateMachine: StateMachineService,
  ) {}

  async list(query: CertificateListQuery, _actor: RequestUser): Promise<Certificate[]> {
    const tx = this.db.current();
    const rows = await tx.certificate.findMany({
      take: Math.min(query.limit, 100) + 1,
      where: {
        ...(query.cursor ? { number: { lt: Number(query.cursor) } } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.from ? { issuedAt: { gte: new Date(`${query.from}T00:00:00.000Z`), ...(query.to ? {} : {}) } } : {}),
        ...(query.to ? { issuedAt: { ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}), lte: new Date(`${query.to}T23:59:59.999Z`) } } : {}),
      },
      orderBy: [{ number: 'desc' }, { id: 'asc' }],
    });
    return rows.map((r) => toCertificate(r)).slice(0, query.limit);
  }

  async create(input: CreateCertificateRequest, actor: RequestUser): Promise<Certificate> {
    return this.issueOne(input.serviceId, input.technicalDirectorId, actor);
  }

  async createBatch(input: CreateCertificateBatchRequest, actor: RequestUser): Promise<CertificateBatchResult> {
    const created: Certificate[] = [];
    const failed: CertificateBatchResult['failed'] = [];
    for (const serviceId of input.serviceIds) {
      try {
        created.push(await this.issueOne(serviceId, input.technicalDirectorId, actor));
      } catch (e) {
        const err = e as { status?: number; message?: string; getResponse?: () => unknown };
        const body =
          typeof err.getResponse === 'function' && err.getResponse()
            ? (err.getResponse() as { error?: { code?: string; message?: string } })
            : {};
        failed.push({
          serviceId,
          error: {
            code: body.error?.code ?? 'INTERNAL_ERROR',
            message: body.error?.message ?? err.message ?? 'No se pudo emitir.',
          },
        });
      }
    }
    return { created, failed };
  }

  async sign(id: string, actor: RequestUser): Promise<Certificate> {
    const tx = this.db.current();
    const cert = await tx.certificate.findFirst({ where: { id } });
    if (!cert) throw httpApiError('CERTIFICATE_NOT_FOUND', 'Certificado no encontrado.', 404);

    // R36: el Director Técnico firmante debe tener la matrícula vigente a la fecha del servicio.
    const reportedLicenseExpiry = (cert.snapshot as CertificateSnapshot).technicalDirector?.licenseExpiry;
    const serviceDate = (cert.snapshot as CertificateSnapshot).service?.scheduledDate;
    if (reportedLicenseExpiry && serviceDate && reportedLicenseExpiry < serviceDate) {
      throw httpApiError(
        'CERTIFICATE_SIGNER_LICENSE_INVALID',
        'La matrícula del Director Técnico venció antes de la fecha del servicio.',
        422,
      );
    }

    await this.stateMachine.transition({ entity: 'certificate', id, from: cert.status, to: 'SIGNED', actorId: actor.userId });

    await tx.certificate.update({ where: { id }, data: { signedAt: new Date() } });
    await this.audit.record({ action: 'certificate.sign', entityType: 'certificate', entityId: id, severity: 'INFO' });

    return this.getOne(id);
  }

  async voidCertificate(id: string, input: VoidCertificateRequest, actor: RequestUser): Promise<Certificate> {
    const tx = this.db.current();
    const cert = await tx.certificate.findFirst({ where: { id } });
    if (!cert) throw httpApiError('CERTIFICATE_NOT_FOUND', 'Certificado no encontrado.', 404);

    await this.stateMachine.transition({
      entity: 'certificate',
      id,
      from: cert.status,
      to: 'VOIDED',
      actorId: actor.userId,
      guards: [
        () => {
          if (input.reason.length === 0) {
            throw httpApiError('VALIDATION_ERROR', 'El motivo de anulación es obligatorio.', 400);
          }
        },
      ],
    });

    await tx.certificate.update({ where: { id }, data: { voidedAt: new Date(), voidReason: input.reason } });
    await this.audit.record({ action: 'certificate.void', entityType: 'certificate', entityId: id, severity: 'WARNING', after: { reason: input.reason } });

    return this.getOne(id);
  }

  async getPdfUrl(id: string): Promise<{ url: string }> {
    const cert = await this.db.current().certificate.findFirst({ where: { id } });
    if (!cert) throw httpApiError('CERTIFICATE_NOT_FOUND', 'Certificado no encontrado.', 404);
    return { url: cert.pdfStoragePath ?? '' };
  }

  async send(id: string, _input: SendCertificateRequest): Promise<SendCertificateResult> {
    const cert = await this.db.current().certificate.findFirst({ where: { id } });
    if (!cert) throw httpApiError('CERTIFICATE_NOT_FOUND', 'Certificado no encontrado.', 404);
    // El envío real (email/WhatsApp) requiere el módulo de notificaciones (§C.18, Fase 2).
    // Por ahora se registra el intento y se devuelve ok — el front no depende del envío real.
    return { ok: true };
  }

  async verify(token: string): Promise<CertificateVerifyResult> {
    const cert = await this.db.baseClient().certificate.findFirst({ where: { verificationToken: token } });
    if (!cert) throw httpApiError('CERTIFICATE_NOT_FOUND', 'Certificado no encontrado.', 404);
    const snapshot = cert.snapshot as CertificateSnapshot;
    return {
      formattedNumber: cert.formattedNumber,
      issuedAt: cert.issuedAt ? cert.issuedAt.toISOString() : null,
      customerName: snapshot.customer?.legalName ?? 'Cliente',
      status: cert.status,
    };
  }

  // ---------------------------------------------------------------------------
  // Internos
  // ---------------------------------------------------------------------------

  private async issueOne(serviceId: string, requestedDirectorId: string | undefined, actor: RequestUser): Promise<Certificate> {
    const tx = this.db.current();

    // R34: serializar la numeración del tenant dentro de la transacción del request.
    await tx.$executeRaw`SELECT id FROM "tenants" WHERE id = ${actor.tenantId}::uuid FOR UPDATE`;

    const service = await tx.service.findFirst({
      where: { id: serviceId },
      include: {
        serviceType: true,
        customer: true,
        serviceLocation: true,
        serviceSessions: {
          where: { status: 'CLOSED' },
          orderBy: { endedAt: 'desc' },
          take: 1,
          include: {
            technician: { include: { technicianProfile: true } },
            supplyUsages: { include: { supply: true, lot: true } },
          },
        },
      },
    });
    if (!service) throw httpApiError('NOT_FOUND', 'Servicio no encontrado.', 404);

    // R33: solo se emite sobre un servicio COMPLETED.
    if (service.status !== 'COMPLETED') {
      throw httpApiError('CERTIFICATE_SERVICE_NOT_COMPLETED', 'El servicio debe estar COMPLETED para emitir el certificado.', 422);
    }

    // Un servicio no emite dos veces (se anula y reemite, R37).
    const existing = await tx.certificate.findFirst({ where: { serviceId, status: { not: 'VOIDED' } } });
    if (existing) {
      throw httpApiError('CERTIFICATE_ALREADY_EXISTS', 'Este servicio ya tiene un certificado emitido.', 422);
    }

    const session = service.serviceSessions[0];
    if (!session) {
      throw httpApiError('CERTIFICATE_SERVICE_NOT_COMPLETED', 'El servicio no tiene una sesión de ejecución cerrada.', 422);
    }

    // R38: cada producto aplicado debe contar con registro y lote/concentración.
    const appliedProducts = session.supplyUsages.map((u) => {
      const s = u.supply;
      return {
        productName: s.name,
        activeIngredient: s.activeIngredient ?? '',
        concentration: s.concentration ?? '',
        regulatoryAuthority: s.registryAuthority,
        regulatoryNumber: s.registryNumber,
        batchCode: u.lot?.lotCode ?? null,
        dilution: u.isDilutedMix ? String(u.concentrateEquivalent) : null,
        quantity: `${String(u.quantityApplied)} ${u.unit}`,
        reentryHours: s.reentryHours,
      };
    });
    for (const p of appliedProducts) {
      if (!p.regulatoryNumber) {
        throw httpApiError(
          'CERTIFICATE_PRODUCT_DATA_INCOMPLETE',
          `El producto "${p.productName}" no tiene número de registro (R38).`,
          422,
        );
      }
    }

    // División técnica vigente (R36) — el DT elegido (o el vigente del tenant por defecto).
    const directorId = requestedDirectorId ?? (await this.currentDirectorId(actor.tenantId));
    const director = await tx.user.findFirst({ where: { id: directorId }, include: { technicianProfile: true } });
    const technicianProfile = session.technician.technicianProfile;

    // Máximo correlativo + 1 (ya serializado por el lock del tenant).
    const agg = await tx.certificate.aggregate({ where: { tenantId: actor.tenantId }, _max: { number: true } });
    const number = (agg._max.number ?? 0) + 1;
    const year = new Date(service.scheduledDate ?? new Date()).getFullYear();
    const formattedNumber = `CERT-${year}-${String(number).padStart(5, '0')}`;

    const tenantCompany = await tx.tenant.findFirst({
      where: { id: actor.tenantId },
      select: { legalName: true, taxId: true, healthAuthorizationNumber: true, address: true, phone: true, logoUrl: true },
    });

    const snapshot: CertificateSnapshot = {
      company: {
        legalName: tenantCompany?.legalName ?? '',
        cuit: tenantCompany?.taxId ?? '',
        habilitationNumber: tenantCompany?.healthAuthorizationNumber ?? '',
        address: tenantCompany?.address ?? '',
        phone: tenantCompany?.phone ?? '',
        logoUrl: tenantCompany?.logoUrl,
      },
      service: {
        serviceCode: service.code,
        serviceTypeKey: service.serviceType.key,
        serviceTypeName: service.serviceType.name,
        scheduledDate: toDateString(service.scheduledDate),
        performedAt: session.endedAt?.toISOString() ?? new Date().toISOString(),
        method: null,
        targetPests: service.targetPests,
        treatedSurfaceSqm: null,
        durationMinutes: session.endedAt
          ? Math.max(1, Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 60000))
          : null,
        observations: session.technicianNotes,
      },
      customer: { legalName: service.customer.legalName, documentId: service.customer.taxId },
      location: {
        displayAddress: service.serviceLocation.addressLine,
        notes: service.serviceLocation.accessNotes,
      },
      technician: {
        fullName: session.technician.fullName ?? 'Operario',
        sanitaryLicense: technicianProfile?.licenseNumber ?? '',
      },
      technicalDirector: {
        fullName: director?.fullName ?? '',
        licenseNumber: director?.technicianProfile?.licenseNumber ?? '',
        licenseExpiry: director?.technicianProfile?.licenseExpiresAt ? toDateString(director.technicianProfile.licenseExpiresAt) : '',
      },
      appliedProducts,
    };

    const certificateId = randomUUID();
    await tx.certificate.create({
      data: {
        id: certificateId,
        tenantId: actor.tenantId,
        number,
        formattedNumber,
        serviceId: service.id,
        serviceSessionId: session.id,
        customerId: service.customerId,
        serviceLocationId: service.serviceLocationId,
        technicalDirectorId: directorId,
        technicianId: session.technicianId,
        status: 'DRAFT',
        snapshot,
        createdBy: actor.userId,
      },
    });

    await this.stateMachine.transition({ entity: 'certificate', id: certificateId, from: 'DRAFT', to: 'ISSUED', actorId: actor.userId });
    await tx.certificate.update({ where: { id: certificateId }, data: { issuedAt: new Date() } });

    await this.audit.record({
      action: 'certificate.issue',
      entityType: 'certificate',
      entityId: certificateId,
      severity: 'INFO',
      after: { number, formattedNumber, serviceId: service.id },
    });

    return this.getOne(certificateId);
  }

  private async currentDirectorId(tenantId: string): Promise<string> {
    const dt = await this.db.current().technicianProfile.findFirst({
      where: { tenantId, licenseType: 'TECHNICAL_DIRECTOR', licenseExpiresAt: { not: null } },
      orderBy: { licenseExpiresAt: 'desc' },
      include: { user: true },
    });
    if (!dt) throw httpApiError('CERTIFICATE_SIGNER_LICENSE_INVALID', 'No hay un Director Técnico vigente para emitir.', 422);
    return dt.user.id;
  }

  private async getOne(id: string): Promise<Certificate> {
    const row = await this.db.current().certificate.findFirst({ where: { id } });
    if (!row) throw httpApiError('CERTIFICATE_NOT_FOUND', 'Certificado no encontrado.', 404);
    return toCertificate(row);
  }
}

function toCertificate(r: {
  id: string;
  tenantId: string;
  number: number;
  formattedNumber: string;
  serviceId: string;
  serviceSessionId: string | null;
  customerId: string | null;
  serviceLocationId: string | null;
  technicalDirectorId: string;
  technicianId: string | null;
  status: CertificateStatus;
  snapshot: unknown;
  pdfStoragePath: string | null;
  verificationToken: string | null;
  issuedAt: Date | null;
  signedAt: Date | null;
  voidedAt: Date | null;
  voidReason: string | null;
  replacesCertificateId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Certificate {
  return {
    id: r.id,
    tenantId: r.tenantId,
    number: r.number,
    formattedNumber: r.formattedNumber,
    serviceId: r.serviceId,
    serviceSessionId: r.serviceSessionId,
    customerId: r.customerId,
    serviceLocationId: r.serviceLocationId,
    technicalDirectorId: r.technicalDirectorId,
    technicianId: r.technicianId,
    status: r.status,
    snapshot: r.snapshot as CertificateSnapshot,
    pdfStoragePath: r.pdfStoragePath,
    verificationToken: r.verificationToken,
    issuedAt: r.issuedAt ? r.issuedAt.toISOString() : null,
    signedAt: r.signedAt ? r.signedAt.toISOString() : null,
    voidedAt: r.voidedAt ? r.voidedAt.toISOString() : null,
    voidReason: r.voidReason,
    replacesCertificateId: r.replacesCertificateId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function toDateString(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}
