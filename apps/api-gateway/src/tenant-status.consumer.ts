/**
 * TenantStatusConsumer — R-03 fix
 *
 * Subscribes to `tenant.TenantStatusChanged` events on the SME event bus and
 * maintains an in-memory cache of tenant activation status.  The gateway reads
 * from this cache (via `isTenantActive`) when enforcing tenant-level access so
 * that status changes propagate within seconds rather than waiting for a TTL on
 * the HTTP-based tenant-service lookup.
 *
 * If the RabbitMQ connection is unavailable on startup the service degrades
 * gracefully — the gateway falls back to the HTTP path already implemented in
 * the JWT guard.
 *
 * For production workloads, swap the in-memory Map for a Redis SET/HSET so
 * the cache survives pod restarts and remains consistent across gateway replicas:
 *
 *   this.redisClient.hset('tenant_status', tenantId, newStatus);
 *
 * The Map key → value is  tenantId → normalised status string (upper-case).
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect } from 'amqplib';

import {
  EventEnvelope,
  SME_EVENTS_EXCHANGE,
  TENANT_STATUS_CHANGED_ROUTING_KEY,
  TenantStatusChangedPayload,
} from '@sme/common';

@Injectable()
export class TenantStatusConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TenantStatusConsumer.name);

  /**
   * In-memory status map: tenantId → normalised status string.
   * Seeded on first query; replenished by incoming events.
   */
  private readonly statusCache = new Map<string, string>();

  private connection: any = null;
  private channel: any = null;

  constructor(private readonly configService: ConfigService) {}

  // ─────────────────────────────────────────────────────────────────────────

  async onModuleInit(): Promise<void> {
    const rabbitMqUrl =
      this.configService.get<string>('RABBITMQ_URL') ?? 'amqp://localhost:5672';

    try {
      this.connection = await connect(rabbitMqUrl);
      this.channel    = await this.connection.createChannel();

      await this.channel.assertExchange(SME_EVENTS_EXCHANGE, 'topic', { durable: true });

      const queueName = 'api-gateway.tenant-status.queue';
      await this.channel.assertQueue(queueName, { durable: true });
      await this.channel.bindQueue(
        queueName,
        SME_EVENTS_EXCHANGE,
        TENANT_STATUS_CHANGED_ROUTING_KEY,
      );

      await this.channel.consume(queueName, (message: any) =>
        void this.processMessage(message),
      );

      this.logger.log('Subscribed to tenant.TenantStatusChanged');
    } catch (err) {
      this.logger.warn(
        `TenantStatusConsumer failed to connect — falling back to HTTP lookups. Reason: ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.channel)    await this.channel.close();
      if (this.connection) await this.connection.close();
    } catch {
      // Ignore teardown errors.
    }
    this.channel    = null;
    this.connection = null;
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns `true` when the cached status is ACTIVE (case-insensitive).
   * Returns `null` when the tenant is not in the cache — callers should
   * fall back to the HTTP tenant-service lookup in that case.
   */
  isTenantActive(tenantId: string): boolean | null {
    const cached = this.statusCache.get(tenantId);
    if (cached === undefined) return null;
    return cached.toUpperCase() === 'ACTIVE';
  }

  /** Manually seed the cache (e.g. after an HTTP lookup resolves status). */
  seedStatus(tenantId: string, status: string): void {
    this.statusCache.set(tenantId, status.toUpperCase());
  }

  // ─────────────────────────────────────────────────────────────────────────

  private async processMessage(message: any): Promise<void> {
    if (!this.channel || !message) return;

    try {
      const envelope = JSON.parse(message.content.toString('utf8')) as EventEnvelope<TenantStatusChangedPayload>;
      const { tenantId, newStatus } = envelope.payload;

      this.statusCache.set(tenantId, newStatus.toUpperCase());
      this.logger.log(`Tenant ${tenantId} status updated to ${newStatus}`);

      this.channel.ack(message);
    } catch (err) {
      this.logger.error('Failed to process TenantStatusChanged message', (err as Error).message);
      this.channel.nack(message, false, false);
    }
  }
}
