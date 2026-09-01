import { Controller, Get, Query } from '@nestjs/common';
import {
  AuditLogListQuerySchema,
  type ApiSuccess,
  type AuditLog,
  type AuditLogListQuery,
} from '@fumibug/contracts';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { apiSuccess } from '../http/api-response';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { AuditService } from './audit.service';

/**
 * docs/spec/03-modulos.md §C.20, contracts listAuditLogs (PR-210): GET /audit-logs.
 *
 * Consulta paginada por cursor del log de auditoría del tenant. Append-only (R42), el
 * único acceso es lectura. Quien consulta debe tener `audit.read` (owner/admin). El
 * aislamiento por tenant es R40 vía RLS + la extensión de Prisma.
 */
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission('audit.read')
  async list(
    @Query(new ZodValidationPipe(AuditLogListQuerySchema)) query: AuditLogListQuery,
  ): Promise<ApiSuccess<AuditLog[]>> {
    return apiSuccess(await this.audit.listLogs(query));
  }
}
