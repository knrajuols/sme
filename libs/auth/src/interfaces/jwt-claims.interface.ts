export interface JwtClaims {
  sub: string;
  tenantId: string;
  roles: string[];
  permissions?: string[];
  sessionId: string;
  iat: number;
  exp: number;
}