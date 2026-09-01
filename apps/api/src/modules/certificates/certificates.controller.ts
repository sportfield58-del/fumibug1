import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  CertificateListQuerySchema,
  type CertificateListQuery,
  type CreateCertificateBatchRequest,
  type CreateCertificateRequest,
  type SendCertificateRequest,
  type VoidCertificateRequest,
} from '@fumibug/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { Public } from '../../common/guards/public.decorator';
import { apiSuccess } from '../../common/http/api-response';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { RequestUser } from '../../common/tenant/request-context';
import { CertificatesService } from './certificates.service';

/**
 * docs/spec/03-modulos.md §C.21 (Certificados) + R33-R38, ADR 0010.
 * `/public/verify/:token` es pública (no requiere auth ni tenant): valida el certificado
 * por su token de verificación — por eso usa la configuración RLS del reino ajeno vía
 * TenantPrismaService.baseClient().
 */
@Controller()
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get('certificates')
  @RequirePermission('certificate.read')
  async list(
    @Query(new ZodValidationPipe(CertificateListQuerySchema)) query: CertificateListQuery,
    @CurrentUser() user: RequestUser,
  ) {
    return apiSuccess(await this.certificates.list(query, user));
  }

  @Post('certificates')
  @RequirePermission('certificate.issue')
  async create(
    @Body() body: CreateCertificateRequest,
    @CurrentUser() user: RequestUser,
  ) {
    return apiSuccess(await this.certificates.create(body, user));
  }

  @Post('certificates/batch')
  @RequirePermission('certificate.issue')
  async createBatch(
    @Body() body: CreateCertificateBatchRequest,
    @CurrentUser() user: RequestUser,
  ) {
    return apiSuccess(await this.certificates.createBatch(body, user));
  }

  @Post('certificates/:id/sign')
  @RequirePermission('certificate.sign')
  async sign(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.certificates.sign(id, user));
  }

  @Post('certificates/:id/void')
  @RequirePermission('certificate.void')
  async voidCertificate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: VoidCertificateRequest,
    @CurrentUser() user: RequestUser,
  ) {
    return apiSuccess(await this.certificates.voidCertificate(id, body, user));
  }

  @Get('certificates/:id/pdf')
  @RequirePermission('certificate.read')
  async getPdf(@Param('id', ParseUUIDPipe) id: string) {
    return apiSuccess(await this.certificates.getPdfUrl(id));
  }

  @Post('certificates/:id/send')
  @RequirePermission('certificate.read')
  async send(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SendCertificateRequest,
  ) {
    return apiSuccess(await this.certificates.send(id, body));
  }

  @Get('public/verify/:token')
  @Public()
  async verify(@Param('token') token: string) {
    return apiSuccess(await this.certificates.verify(token));
  }
}
