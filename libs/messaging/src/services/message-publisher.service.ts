import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect } from 'amqplib';

import { EventEnvelope, SME_EVENTS_EXCHANGE } from '@sme/common';

@Injectable()
export class MessagePublisherService implements OnModuleInit, OnModuleDestroy {
  private connection: any = null;

  private channel: any = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const rabbitMqUrl =
      this.configService.get<string>('RABBITMQ_URL') ?? 'amqp://localhost:5672';
    this.connection = await connect(rabbitMqUrl);
    this.channel = await this.connection.createConfirmChannel();
    await this.channel.assertExchange(SME_EVENTS_EXCHANGE, 'topic', {
      durable: true,
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }

    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  async publish<TPayload>(
    routingKey: string,
    envelope: EventEnvelope<TPayload>,
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ publisher channel is not initialized');
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
