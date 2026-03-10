import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../generated/prisma-client';
import { softDeleteMiddleware } from '@sme/common';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private readonly configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get<string>('DATABASE_URL')!,
        },
      },
    });
    // Cast bridges the ModelName union mismatch between @sme/common's
    // @prisma/client reference and the locally-generated client. The
    // middleware shape is structurally identical at runtime.
    this.$use(softDeleteMiddleware() as Parameters<typeof this.$use>[0]);
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
