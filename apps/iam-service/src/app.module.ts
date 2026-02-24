import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { dirname, join } from 'path';

import { AuthModule } from '@sme/auth';
import { SmeLoggerModule } from '@sme/logger';
import { MessagingModule } from '@sme/messaging';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { TenantCreatedConsumer } from './tenant-created.consumer';

const appRoot = dirname(process.env.npm_package_json ?? join(process.cwd(), 'package.json'));

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvVars: true,
      envFilePath: [
        join(appRoot, `.env.${process.env.NODE_ENV ?? 'development'}`),
        join(appRoot, '.env'),
      ],
    }),
    AuthModule,
    SmeLoggerModule,
    MessagingModule,
    PrismaModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService, TenantCreatedConsumer],
})
export class AppModule {}
