import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { ConfirmEvidenceRequest, UploadEvidenceUrlRequest } from '@fumibug/contracts';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { apiSuccess } from '../../common/http/api-response';
import type { RequestUser } from '../../common/tenant/request-context';
import { EvidenceService } from './evidence.service';

/** docs/spec/03-modulos.md §C.11, contracts (PR-106). */
@Controller('field/sessions')
export class EvidenceController {
  constructor(private readonly evidence: EvidenceService) {}

  @Post(':id/evidence/upload-url')
  @RequirePermission('evidence.upload')
  async uploadUrl(@Param('id', ParseUUIDPipe) id: string, @Body() body: UploadEvidenceUrlRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.evidence.createUploadUrl(id, body, user));
  }

  @Post(':id/evidence')
  @RequirePermission('evidence.upload')
  async confirm(@Param('id', ParseUUIDPipe) id: string, @Body() body: ConfirmEvidenceRequest, @CurrentUser() user: RequestUser) {
    return apiSuccess(await this.evidence.confirm(id, body, user));
  }
}
