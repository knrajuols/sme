export const SME_EVENTS_EXCHANGE = 'sme.events';
export const TENANT_CREATED_ROUTING_KEY = 'tenant.TenantCreated';
export const AUDIT_EVENT_REQUESTED_ROUTING_KEY = 'audit.AuditEventRequested';

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
  primaryContactPhone: string;
  planId?: string;
}

export interface AuditEventRequestedPayload {
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  metadata?: Record<string, unknown>;
}