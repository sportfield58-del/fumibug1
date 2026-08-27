import { Controller, Get } from '@nestjs/common';
import type { AdminDashboardResponse, ApiSuccess, OwnerDashboardResponse } from '@fumibug/contracts';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { apiSuccess } from '../../common/http/api-response';
import { DashboardService } from './dashboard.service';

/** docs/spec/10-api.md §J.2 "Reportes", contracts endpoints getAdminDashboard/getOwnerDashboard. */
@Controller('reports')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @RequirePermission('report.operational')
  @Get('dashboard-admin')
  async admin(): Promise<ApiSuccess<AdminDashboardResponse>> {
    return apiSuccess(await this.dashboard.admin());
  }

  @RequirePermission('report.financial')
  @Get('dashboard-owner')
  async owner(): Promise<ApiSuccess<OwnerDashboardResponse>> {
    return apiSuccess(await this.dashboard.owner());
  }
}
