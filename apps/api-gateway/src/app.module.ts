import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { dirname, join } from 'path';

import { AuthModule } from '@sme/auth';
import { MODULE_CHECKER_TOKEN, ModuleGuard } from '@sme/auth';
import { CorrelationMiddleware, IdempotencyInterceptor } from '@sme/common';
import { ConfigClientModule, ConfigClientService } from '@sme/config-client';
import { SmeLoggerModule } from '@sme/logger';
import { MessagingModule } from '@sme/messaging';
import { TenantClientModule } from '@sme/tenant-client';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TenantStatusConsumer } from './tenant-status.consumer';

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

    // RISK-07 fix: rate limiting.
    // One global throttle at 2 000 req/min; the auth endpoint overrides this
    // to 10 req/min via @Throttle({ global: { ... } }) on the handler.
    ThrottlerModule.forRoot([
      { name: 'global', ttl: 60_000, limit: 2_000 },
    ]),

    SmeLoggerModule,
    AuthModule,
    MessagingModule,
    ConfigClientModule,
    TenantClientModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,

    // R-03 fix: subscribe to TenantStatusChanged events.
    TenantStatusConsumer,

    // RISK-06 fix: idempotency key enforcement at the gateway.
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },

    // RISK-07 fix: apply rate-limiting globally.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    // RISK-07 fix: enforce module entitlements on all routes.
    {
      provide: MODULE_CHECKER_TOKEN,
      useExisting: ConfigClientService,
    },
    {
      provide: APP_GUARD,
      useClass: ModuleGuard,
    },
  ],
})
export class AppModule implements NestModule {
  /** RISK-06 / Correlation fix: inject x-correlation-id on every request. */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}

