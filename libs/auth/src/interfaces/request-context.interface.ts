import type { IncomingHttpHeaders } from 'http';

import type { JwtClaims } from './jwt-claims.interface';

export interface AuthenticatedRequest {
  headers: IncomingHttpHeaders;
  path?: string;
  url?: string;
  params?: Record<string, string | undefined>;
  user?: JwtClaims;
  tenantId?: string;
  impersonatedTenantId?: string;
}