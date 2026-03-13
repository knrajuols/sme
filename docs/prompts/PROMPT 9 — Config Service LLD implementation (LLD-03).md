
PROMPT 9 — Config Service LLD implementation (LLD-03)

Implement config-service per LLD-03.

Prisma schema: config_master, module_entitlements, feature_flags, workflow_rules.

APIs:
GET /config/modules
POST /config/modules/:moduleKey/enable
POST /config/modules/:moduleKey/disable
GET /config/:category/:configKey
PUT /config/:category/:configKey (versioned update)
POST /config/:category/:configKey/rollback/:version

Implement Redis cache for config snapshots and modules keys.
Emit events: ConfigUpdated, ModuleEnabled, ModuleDisabled and AuditEventRequested.

Provide internal endpoint for gateway:
GET /internal/modules/:tenantId (secured by internal secret header)

Seed defaults on TenantCreated event consumption:
- default module map
- default grading config
- default academic year skeleton
- default workflow rules placeholders

Swagger docs + health.