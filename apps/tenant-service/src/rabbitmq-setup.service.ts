import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect } from 'amqplib';

import { SME_EVENTS_EXCHANGE } from '@sme/common';

@Injectable()
export class RabbitMqSetupService implements OnModuleInit, OnModuleDestroy {
  private connection: any = null;

  private channel: any = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const rabbitMqUrl =
      this.configService.get<string>('RABBITMQ_URL') ?? 'amqp://localhost:5672';

    this.connection = await connect(rabbitMqUrl);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(SME_EVENTS_EXCHANGE, 'topic', {
      durable: true,
    });
    await this.channel.assertQueue('tenant-service.queue', {
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
}
