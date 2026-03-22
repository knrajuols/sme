export interface JwtClaims {
  sub: string;
  tenantId: string;
  roles: string[];
  permissions?: string[];
  sessionId: string;
  /** Login email of the authenticated user — included for display purposes only. */
  email?: string;
  /** True when staff must change their default password before accessing the platform. */
  requiresPasswordChange?: boolean;
  /** The employee's EmployeeRole.systemCategory — enables future RBAC decisions. */
  systemCategory?: string;
  iat: number;
  exp: number;
}