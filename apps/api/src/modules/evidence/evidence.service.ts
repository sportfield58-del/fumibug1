import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ConfirmEvidenceRequest, ServiceEvidence, UploadEvidenceUrlRequest, UploadEvidenceUrlResponse } from '@fumibug/contracts';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { httpApiError } from '../../common/http/api-response';
import type { RequestUser } from '../../common/tenant/request-context';
import { SupabaseStorageClient } from './supabase-storage.client';

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

/**
 * docs/spec/03-modulos.md §C.11, docs/spec/09-reglas.md R43 (idempotencia).
 * Evidencia (fotos antes/después, firma) de una sesión de campo — PR-207.
 */
@Injectable()
export class EvidenceService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly storage: SupabaseStorageClient,
  ) {}

  async createUploadUrl(sessionId: string, input: UploadEvidenceUrlRequest, actor: RequestUser): Promise<UploadEvidenceUrlResponse> {
    await this.ownSession(sessionId, actor);
    const ext = MIME_EXT[input.mimeType] ?? 'bin';
    const storagePath = `${actor.tenantId}/${sessionId}/${randomUUID()}.${ext}`;
    const { uploadUrl, expiresAt } = await this.storage.createSignedUploadUrl(storagePath);
    return { uploadUrl, storagePath, expiresAt };
  }

  async confirm(sessionId: string, input: ConfirmEvidenceRequest, actor: RequestUser): Promise<ServiceEvidence> {
    const tx = this.db.current();
    const existingReplay = await tx.serviceEvidence.findFirst({ where: { clientEventId: input.clientEventId } });
    if (existingReplay) return toEvidence(existingReplay);

    await this.ownSession(sessionId, actor);
    const row = await tx.serviceEvidence.create({
      data: {
        id: randomUUID(),
        tenantId: actor.tenantId,
        serviceSessionId: sessionId,
        type: input.type,
        category: input.category,
        storagePath: input.storagePath,
        mimeType: input.mimeType ?? null,
        sizeBytes: input.sizeBytes ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        sha256: input.sha256 ?? null,
        takenAt: input.takenAt ? new Date(input.takenAt) : null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        accuracyM: input.accuracyM ?? null,
        clientEventId: input.clientEventId,
      },
    });
    return toEvidence(row);
  }

  private async ownSession(sessionId: string, actor: RequestUser): Promise<void> {
    const session = await this.db.current().serviceSession.findFirst({ where: { id: sessionId } });
    if (!session || session.technicianId !== actor.userId) {
      throw httpApiError('NOT_FOUND', 'Sesión no encontrada.', 404);
    }
  }
}

interface EvidenceRow {
  id: string;
  tenantId: string;
  serviceSessionId: string;
  type: string;
  category: string;
  storagePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  sha256: string | null;
  takenAt: Date | null;
  uploadedAt: Date;
  lat: unknown;
  lng: unknown;
  accuracyM: unknown;
  clientEventId: string;
}

function toEvidence(r: EvidenceRow): ServiceEvidence {
  return {
    id: r.id,
    tenantId: r.tenantId,
    serviceSessionId: r.serviceSessionId,
    type: r.type as ServiceEvidence['type'],
    category: r.category as ServiceEvidence['category'],
    storagePath: r.storagePath,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    width: r.width,
    height: r.height,
    sha256: r.sha256,
    takenAt: r.takenAt ? r.takenAt.toISOString() : null,
    uploadedAt: r.uploadedAt.toISOString(),
    lat: r.lat !== null ? Number(r.lat) : null,
    lng: r.lng !== null ? Number(r.lng) : null,
    accuracyM: r.accuracyM !== null ? Number(r.accuracyM) : null,
    clientEventId: r.clientEventId,
  };
}
