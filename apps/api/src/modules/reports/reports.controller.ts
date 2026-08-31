import { Controller, Get, Query } from '@nestjs/common';
import { ReportQuerySchema, type ReportQuery } from '@fumibug/contracts';
import { apiSuccess } from '../../common/http/api-response';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ReportsService } from './reports.service';

/**
 * docs/spec/19-mvp-roadmap.md (8 reportes) + §P, ADR 0010.
 * Un endpoint tipado por `type` en vez de 8 rutas hardcodeadas.
 */
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @RequirePermission('report.operational', 'report.financial')
  async generate(@Query(new ZodValidationPipe(ReportQuerySchema)) query: ReportQuery) {
    return apiSuccess(await this.reports.generate(query));
  }
}
