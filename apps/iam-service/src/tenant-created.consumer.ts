import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect } from 'amqplib';

import {
  EventEnvelope,
  SME_EVENTS_EXCHANGE,
  TENANT_CREATED_ROUTING_KEY,
  TenantCreatedPayload,
} from '@sme/common';

import { AppService } from './app.service';

@Injectable()
export class TenantCreatedConsumer implements OnModuleInit, OnModuleDestroy {
  private connection: any = null;

  private channel: any = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly appService: AppService,
  ) {}

  async onModuleInit(): Promise<void> {
    const rabbitMqUrl =
      this.configService.get<string>('RABBITMQ_URL') ?? 'amqp://localhost:5672';

    this.connection = await connect(rabbitMqUrl);
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange(SME_EVENTS_EXCHANGE, 'topic', {
      durable: true,
    });

    const queueName = 'iam-service.queue';
    await this.channel.assertQueue(queueName, { durable: true });
    await this.channel.bindQueue(
      queueName,
      SME_EVENTS_EXCHANGE,
      TENANT_CREATED_ROUTING_KEY,
    );

    await this.channel.consume(queueName, async (message: any) => {
      await this.processMessage(message);
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

  private async processMessage(message: any): Promise<void> {
    if (!this.channel || !message) {
      return;
    }

    try {
      const envelope = JSON.parse(message.content.toString('utf8')) as EventEnvelope<TenantCreatedPayload>;
      await this.appService.handleTenantCreatedEvent(envelope);
      this.channel.ack(message);
    } catch {
      this.channel.nack(message, false, false);
    }
  }
}
