

PROMPT 6 — API Gateway LLD implementation (LLD-05 enforced)

Implement api-gateway app per LLD-05.

Requirements:
- Routes to downstream services using configurable base URLs.
- Enforce:
  - JWT auth (except /auth/login, /auth/refresh)
  - tenant status check using tenant-client (Redis cached)
  - module enablement check using config-client (Redis cached)
  - correlation ID injection (from libs/common)
  - rate limiting per tenant + per user
- Provide route map config in a JSON/YAML file under api-gateway.
- Provide module mapping table for route prefixes:
  /attendance->attendance, /fees->fees, /exam->exam, /transport->transport, /library->library, /inventory->inventory, /portal->portal, /website->website
- Ensure /platform/* bypass module checks but requires PLATFORM_ADMIN role.
- Return standard envelopes for all gateway errors.

Add Swagger for gateway endpoints (proxy endpoints can be documented minimally).

Implement health endpoints /health/live and /health/ready (check Redis + Tenant client + Config client connectivity).