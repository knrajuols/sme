import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { dirname, join } from 'path';

import { AuthModule } from '@sme/auth';
import { ConfigClientModule } from '@sme/config-client';
import { SmeLoggerModule } from '@sme/logger';
import { MessagingModule } from '@sme/messaging';
import { TenantClientModule } from '@sme/tenant-client';

import { AppController } from './app.controller';
import { AppService } from './app.service';

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
    SmeLoggerModule,
    AuthModule,
    MessagingModule,
    ConfigClientModule,
    TenantClientModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
