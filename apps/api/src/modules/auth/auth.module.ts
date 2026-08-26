import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from '../../common/guards/jwt.strategy';

/**
 * docs/spec/16-estructura.md §U: modules/auth = controller · service · guards ·
 * strategies. Los guards compartidos (JwtGuard/TenantGuard/PermissionGuard) viven
 * en common/guards porque los usan TODOS los módulos; la strategy de verificación
 * de tokens es específica del dominio auth y vive acá.
 */
@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [JwtStrategy],
})
export class AuthModule {}
