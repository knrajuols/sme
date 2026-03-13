export const SME_EVENTS_EXCHANGE = 'sme.events';
export const TENANT_CREATED_ROUTING_KEY = 'tenant.TenantCreated';
export const TENANT_STATUS_CHANGED_ROUTING_KEY = 'tenant.TenantStatusChanged';
export const AUDIT_EVENT_REQUESTED_ROUTING_KEY = 'audit.AuditEventRequested';
export const MODULE_ENABLED_ROUTING_KEY = 'config.ModuleEnabled';
export const MODULE_DISABLED_ROUTING_KEY = 'config.ModuleDisabled';

export interface EventActor {
  actorType: string;
  actorId: string;
  role: string;
}

export interface EventProducer {
  service: string;
}

export interface EventEnvelope<TPayload = Record<string, unknown>> {
  eventId: string;
  eventType: string;
  eventVersion: string;
  tenantId: string;
  occurredAt: string;
  correlationId: string;
  producer: EventProducer;
  actor: EventActor;
  payload: TPayload;
}

export interface TenantCreatedPayload {
  tenantId: string;
  tenantCode: string;
  schoolName: string;
  status: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone?: string;  // optional — phone may be collected in progressive profiling step
  planId?: string;
}

export interface TenantStatusChangedPayload {
  tenantId: string;
  tenantCode: string;
  oldStatus: string;
  newStatus: string;
  changedBy: string;
  reason?: string;
}

export interface AuditEventRequestedPayload {
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  module?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface ModuleTogglePayload {
  moduleKey: string;
  tenantId: string;
  enabled: boolean;
  changedBy: string;
  reason?: string;
}