

PROMPT 3 — Common library (standards enforced everywhere)

Implement libs/common with the following:

1) Error codes enum (AUTH_INVALID_TOKEN, AUTH_FORBIDDEN, TENANT_SUSPENDED, VALIDATION_ERROR, RESOURCE_NOT_FOUND, CONFLICT_DUPLICATE, INTERNAL_ERROR, MODULE_DISABLED, RATE_LIMITED, etc.)
2) Standard response helpers: ok(data, message?), fail(code, message, details?, httpStatus?)
3) Global exception filter converting exceptions to standard envelope.
4) Correlation ID middleware:
   - reads X-Correlation-Id, generates uuid if missing
   - attaches to request context
   - adds to response headers
5) RequestContext type with:
   - correlationId
   - tenantId
   - userId
   - roles
   - sessionId
6) Pagination DTOs: PageQueryDto, PageResult<T>
7) Validation pipe setup (whitelist=true, forbidNonWhitelisted=true, transform=true)

Add unit tests for response helpers and correlation middleware.

Do not modify app code yet; only implement libs/common and export cleanly.