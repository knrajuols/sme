PROMPT 5 — Messaging library (Event envelope + RMQ)

Implement libs/messaging:

- EventEnvelope<TPayload> type exactly matching:
  eventId, eventType, eventVersion, tenantId, occurredAt, producer{service,instanceId}, correlationId, actor{actorType,actorId,role,ip}, payload
- RabbitMQ module providing:
  - publisher service with retry + dead-letter support (configure names)
  - consumer base class handling idempotency hooks (placeholder)
- Standard exchanges/queues naming conventions:
  - exchange: sme.events (topic)
  - queues: <service>.queue
  - routing keys: <domain>.<eventType> (e.g., student.StudentCreated)

Create example publish/consume usage code in a docs markdown inside libs/messaging/docs.md.