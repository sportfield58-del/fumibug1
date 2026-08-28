import { Injectable } from '@nestjs/common';
import type {
  AdminDashboardResponse,
  DashboardAlert,
  OwnerDashboardResponse,
} from '@fumibug/contracts';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { argentinaDayBounds } from '../../common/date/argentina-date';

/**
 * GET /reports/dashboard-admin y /reports/dashboard-owner —
 * docs/spec/03-modulos.md §C.1, contracts/schemas/dashboard.ts (PR-106).
 *
 * "Hoy" en el calendario de Argentina (argentinaDayBounds — ver common/date), no en
 * UTC: con el corte en UTC, "hoy" en el servidor dejaba de coincidir con "hoy" en
 * pantalla entre las 21:00 y medianoche hora argentina (bug real, encontrado
 * probando la demo un día a la tarde/noche). "Este mes" (monthBounds, más abajo)
 * sigue en UTC — el corrimiento ahí solo importa en el borde del mes, caso aceptado.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly db: TenantPrismaService) {}

  async admin(): Promise<AdminDashboardResponse> {
    const tx = this.db.current();
    const { start: todayStart, end: todayEnd } = argentinaDayBounds();

    const [statusGroups, activeTechnicianRoutes, unassignedCount, expiringLicenses, pendingValidation, cashToday] =
      await Promise.all([
        tx.service.groupBy({
          by: ['status'],
          where: { scheduledDate: { gte: todayStart, lt: todayEnd } },
          _count: { _all: true },
        }),
        tx.route.findMany({
          where: { routeDate: { gte: todayStart, lt: todayEnd }, status: { in: ['PUBLISHED', 'IN_PROGRESS'] } },
          select: { technicianId: true },
          distinct: ['technicianId'],
        }),
        tx.service.count({
          where: { status: 'SCHEDULED', routeStops: { none: {} } },
        }),
        tx.technicianProfile.findMany({
          where: {
            licenseType: 'SANITARY_BOOK',
            licenseExpiresAt: { not: null, lte: addDays(new Date(), 30) },
          },
          select: { licenseExpiresAt: true, user: { select: { id: true, fullName: true, email: true } } },
        }),
        tx.service.count({ where: { status: 'PENDING_VALIDATION' } }),
        tx.payment.groupBy({
          by: ['method'],
          where: { status: 'CONFIRMED', paidAt: { gte: todayStart, lt: todayEnd } },
          _sum: { amountCents: true },
        }),
      ]);

    const servicesTodayByStatus = Object.fromEntries(
      statusGroups.map((g) => [g.status, g._count._all]),
    ) as AdminDashboardResponse['servicesTodayByStatus'];

    const alerts: DashboardAlert[] = [];
    for (const tp of expiringLicenses) {
      const days = tp.licenseExpiresAt ? daysUntil(tp.licenseExpiresAt) : null;
      alerts.push({
        type: 'LICENSE_EXPIRING',
        message: `La libreta sanitaria de ${tp.user.fullName ?? tp.user.email} vence en ${days ?? '?'} días.`,
        entityId: tp.user.id,
        severity: days !== null && days <= 7 ? 'CRITICAL' : 'WARNING',
      });
    }
    if (pendingValidation > 0) {
      alerts.push({
        type: 'PENDING_CLOSURE',
        message: `${pendingValidation} servicio(s) esperando validación de cierre.`,
        entityId: null,
        severity: 'INFO',
      });
    }

    const cashCents = sumMethod(cashToday, 'CASH');
    const transferCents = sumMethod(cashToday, 'TRANSFER');

    return {
      servicesTodayByStatus,
      activeTechniciansCount: activeTechnicianRoutes.length,
      unassignedServicesCount: unassignedCount,
      alerts,
      collectedTodayCashCents: cashCents,
      collectedTodayTransferCents: transferCents,
    };
  }

  async owner(): Promise<OwnerDashboardResponse> {
    const tx = this.db.current();
    const { start: monthStart, end: monthEnd } = monthBounds(new Date());

    const [billed, completedCount, pendingClosures] = await Promise.all([
      tx.service.aggregate({
        where: { status: 'COMPLETED', scheduledDate: { gte: monthStart, lt: monthEnd } },
        _sum: { priceCents: true },
        _count: { _all: true },
      }),
      tx.service.count({
        where: { status: 'COMPLETED', scheduledDate: { gte: monthStart, lt: monthEnd } },
      }),
      tx.cashClosure.findMany({
        where: { status: { in: ['DECLARED', 'DISPUTED'] } },
        select: { declaredCents: true, expectedCents: true },
      }),
    ]);

    const billedThisMonthCents = Number(billed._sum.priceCents ?? 0n);
    const cashPendingReconciliationCents = pendingClosures.reduce(
      (acc, c) => acc + Number(c.declaredCents ?? c.expectedCents ?? 0n),
      0,
    );
    const averageTicketCents = completedCount > 0 ? Math.round(billedThisMonthCents / completedCount) : 0;

    return {
      billedThisMonthCents,
      cashPendingReconciliationCents,
      completedServicesThisMonth: completedCount,
      averageTicketCents,
    };
  }
}

function monthBounds(ref: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
  return { start, end };
}

function addDays(ref: Date, days: number): Date {
  const d = new Date(ref);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function daysUntil(target: Date): number {
  return Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function sumMethod(
  groups: Array<{ method: string; _sum: { amountCents: bigint | null } }>,
  method: string,
): number {
  const match = groups.find((g) => g.method === method);
  return match ? Number(match._sum.amountCents ?? 0n) : 0;
}
