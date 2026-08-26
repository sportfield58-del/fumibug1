import type { RequestUser } from '../common/tenant/request-context';

/**
 * Augmentación de Express para tipar req.user / req.tenantId sin casts.
 * Los puebla JwtGuard y TenantGuard respectivamente.
 */
declare global {
   
  namespace Express {
    interface Request {
      user?: RequestUser;
      tenantId?: string;
    }
  }
}

export {};
