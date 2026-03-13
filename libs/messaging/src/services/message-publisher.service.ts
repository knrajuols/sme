import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect } from 'amqplib';

import { EventEnvelope, SME_EVENTS_EXCHANGE } from '@sme/common';

@Injectable()
export class MessagePublisherService implements OnModuleInit, OnModuleDestroy {
  private connection: any = null;
  private channel: any = null;
  private readonly logger = new Logger(MessagePublisherService.name);

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const rabbitMqUrl =
      this.configService.get<string>('RABBITMQ_URL') ?? 'amqp://localhost:5672';
    try {
      this.connection = await connect(rabbitMqUrl);
      this.channel = await this.connection.createConfirmChannel();
      await this.channel.assertExchange(SME_EVENTS_EXCHANGE, 'topic', {
        durable: true,
      });
      this.logger.log('RabbitMQ connected successfully');
    } catch (err) {
      // Non-fatal in dev — service continues without messaging.
      // Events will be lost until RabbitMQ is available and service is restarted.
      // TODO (Production): make this fatal or implement reconnect logic.
      this.logger.warn(
        `RabbitMQ unavailable — messaging disabled. Reason: ${err instanceof Error ? err.message : String(err)}`,
      );
      this.connection = null;
      this.channel = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
    } catch {
      // ignore cleanup errors
    }
    this.channel = null;
    this.connection = null;
  }

  async publish<TPayload>(
    routingKey: string,
    envelope: EventEnvelope<TPayload>,
  ): Promise<void> {
    if (!this.channel) {
      // RabbitMQ not connected — log and skip rather than crash the caller.
      this.logger.warn(
        `[MESSAGING SKIPPED] RabbitMQ channel not available. Event type="${envelope.eventType}" id="${envelope.eventId}" was NOT delivered.`,
      );
      return;
    }

    const payload = Buffer.from(JSON.stringify(envelope));
    this.channel.publish(SME_EVENTS_EXCHANGE, routingKey, payload, {
      persistent: true,
      contentType: 'application/json',
      messageId: envelope.eventId,
      type: envelope.eventType,
      correlationId: envelope.correlationId,
      timestamp: Date.now(),
    });

    await this.channel.waitForConfirms();
  }
}
