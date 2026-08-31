import { Injectable } from '@nestjs/common';
import type { ReportQuery, ReportResponse } from '@fumibug/contracts';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { httpApiError } from '../../common/http/api-response';

/**
 * docs/spec/19-mvp-roadmap.md (8 reportes) + §P inventario/caja, ADR 0010.
 *
 * Endpoint único `GET /reports?type=` con filas tipadas por unión discriminada. Agregación
 * por tenant a partir de las proyecciones del esquema (services, service_sessions,
 * payments, service_supply_usage, inventory, cash_closures, certificates).
 *
 * Nota de alcance: para el MVP se agrega con aggregates de Prisma (+ un par de pasadas en
 * JS para joins de nombres y promedios de duración). Si un reporte crece mucho, se pasa a
 * una vista materializada por tenant (R42 lo permite: lectura no bloqueante).
 */
@Injectable()
export class ReportsService {
  constructor(private readonly db: TenantPrismaService) {}

  async generate(query: ReportQuery): Promise<ReportResponse> {
    const from = query.from ? new Date(`${query.from}T00:00:00.000Z`) : undefined;
    const to = query.to ? new Date(`${query.to}T00:00:00.000Z`) : undefined;
    const range = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    } as const;
    const hasRange = from !== undefined || to !== undefined;

    const tx = this.db.current();

    switch (query.type) {
      case 'services_by_status': {
        const rows = await tx.service.groupBy({
          by: ['status'],
          _count: { _all: true },
          ...(hasRange ? { where: { scheduledDate: range } } : {}),
        });
        return {
          rows: rows.map((r) => ({ type: 'services_by_status', status: r.status, count: r._count._all })),
        };
      }

      case 'productivity_by_technician': {
        const sessions = await tx.serviceSession.findMany({
          where: { status: 'CLOSED', endedAt: { not: null, ...(hasRange ? {} : {}) }, ...(query.technicianId ? { technicianId: query.technicianId } : {}) },
          include: { technician: true },
        });
        const grouped = new Map<
          string,
          { name: string; count: number; totalMinutes: number }
        >();
        for (const s of sessions) {
          const startedAt = s.startedAt;
          const endedAt = s.endedAt ?? startedAt;
          const minutes = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
          if (hasRange && (startedAt < (from ?? new Date(0)) || startedAt > (to ?? new Date('9999-12-31')))) continue;
          const cur = grouped.get(s.technicianId) ?? { name: s.technician.fullName ?? 'Operario', count: 0, totalMinutes: 0 };
          cur.count += 1;
          cur.totalMinutes += minutes;
          grouped.set(s.technicianId, cur);
        }
        return {
          rows: [...grouped.entries()].map(([technicianId, v]) => ({
            type: 'productivity_by_technician',
            technicianId,
            technicianName: v.name,
            servicesDone: v.count,
            avgMinutes: v.count > 0 ? Math.round(v.totalMinutes / v.count) : null,
          })),
        };
      }

      case 'revenue_by_period': {
        const services = await tx.service.findMany({
          where: { status: 'COMPLETED', ...(query.technicianId ? {} : {}) },
          include: { serviceSessions: { where: { status: 'CLOSED' }, select: { endedAt: true }, take: 1 } },
        });
        const byPeriod = new Map<string, bigint>();
        for (const s of services) {
          const date = s.serviceSessions[0]?.endedAt ?? s.scheduledDate ?? null;
          if (!date) continue;
          if (hasRange && (date < (from ?? new Date(0)) || date > (to ?? new Date('9999-12-31')))) continue;
          const period = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
          byPeriod.set(period, (byPeriod.get(period) ?? BigInt(0)) + s.priceCents);
        }
        return {
          rows: [...byPeriod.entries()].map(([period, totalCents]) => ({
            type: 'revenue_by_period',
            period,
            totalCents: Number(totalCents),
          })),
        };
      }

      case 'collected_by_method': {
        const rows = await tx.payment.groupBy({
          by: ['method'],
          _sum: { amountCents: true },
          where: {
            status: 'CONFIRMED',
            ...(hasRange ? { paidAt: range } : {}),
            ...(query.technicianId ? {} : {}),
          },
          orderBy: { _sum: { amountCents: 'desc' } },
        });
        return {
          rows: rows.map((r) => ({
            type: 'collected_by_method',
            method: r.method,
            totalCents: Number(r._sum.amountCents ?? BigInt(0)),
          })),
        };
      }

      case 'supply_consumption': {
        const usages = await tx.serviceSupplyUsage.findMany({
          include: { supply: true },
          ...(hasRange ? { where: { serviceSession: { endedAt: range } } } : {}),
        });
        const bySupply = new Map<string, { name: string; qty: number }>();
        for (const u of usages) {
          const cur = bySupply.get(u.supplyId) ?? { name: u.supply.name, qty: 0 };
          cur.qty += Number(u.quantityApplied);
          bySupply.set(u.supplyId, cur);
        }
        return {
          rows: [...bySupply.entries()].map(([supplyId, v]) => ({
            type: 'supply_consumption',
            supplyId,
            supplyName: v.name,
            quantityApplied: Number(v.qty.toFixed(4)),
          })),
        };
      }

      case 'stock_current': {
        const rows = await tx.inventory.findMany({
          include: { supply: true, stockLocation: true },
        });
        return {
          rows: rows.map((r) => ({
            type: 'stock_current',
            supplyId: r.supplyId,
            supplyName: r.supply.name,
            stockLocation: r.stockLocation.name,
            balance: Number(r.quantity),
          })),
        };
      }

      case 'settlements': {
        const closures = await tx.cashClosure.findMany({
          ...(hasRange ? { where: { periodStart: range } } : {}),
        });
        const byAccount = new Map<string, { declaredCents: bigint; reconciled: boolean }>();
        for (const c of closures) {
          const cur = byAccount.get(c.cashAccountId) ?? { declaredCents: BigInt(0), reconciled: false };
          cur.declaredCents += c.declaredCents ?? BigInt(0);
          if (c.status === 'RECONCILED') cur.reconciled = true;
          byAccount.set(c.cashAccountId, cur);
        }
        return {
          rows: [...byAccount.entries()].map(([accountId, v]) => ({
            type: 'settlements',
            accountId,
            declaredCents: Number(v.declaredCents),
            reconciled: v.reconciled,
          })),
        };
      }

      case 'certificates_issued': {
        const certs = await tx.certificate.findMany({
          where: { issuedAt: { not: null } },
          select: { issuedAt: true },
        });
        const byPeriod = new Map<string, number>();
        for (const c of certs) {
          if (!c.issuedAt) continue;
          if (hasRange && (c.issuedAt < (from ?? new Date(0)) || c.issuedAt > (to ?? new Date('9999-12-31')))) continue;
          const period = `${c.issuedAt.getUTCFullYear()}-${String(c.issuedAt.getUTCMonth() + 1).padStart(2, '0')}`;
          byPeriod.set(period, (byPeriod.get(period) ?? 0) + 1);
        }
        return {
          rows: [...byPeriod.entries()].map(([period, count]) => ({ type: 'certificates_issued', period, count })),
        };
      }

      default: {
        throw httpApiError('VALIDATION_ERROR', 'Tipo de reporte no soportado.', 400);
      }
    }
  }
}
