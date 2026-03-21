export interface JwtClaims {
  sub: string;
  tenantId: string;
  roles: string[];
  permissions?: string[];
  sessionId: string;
  /** Login email of the authenticated user — included for display purposes only. */
  email?: string;
  iat: number;
  exp: number;
}