import { Test, type TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AuditService } from './common/audit/audit.service';
import type { PermissionKey } from '@fumibug/contracts';

describe('AppController', () => {
  let controller: AppController;
  let audit: { record: jest.Mock };

  const USER = {
    userId: 'u-1',
    email: 'owner@fumibug.dev',
    tenantId: 't-1',
    roleKey: 'owner',
    permissions: ['audit.read'] as PermissionKey[],
  };

  beforeEach(async () => {
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AuditService, useValue: audit }],
    }).compile();

    controller = moduleRef.get(AppController);
  });

  it('health: responde ok', () => {
    expect(controller.health()).toEqual({ status: 'ok', service: 'fumibug-api' });
  });

  it('ping: devuelve usuario, tenant y permisos efectivos, y audita', async () => {
    const result = await controller.ping(USER);
    expect(result).toEqual({
      success: true,
      data: { userId: 'u-1', tenantId: 't-1', roleKey: 'owner', permissions: ['audit.read'] },
    });
    expect(audit.record).toHaveBeenCalledWith({
      action: 'ping',
      entityType: 'system',
      severity: 'INFO',
    });
  });
});
