import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { ApiKeyGuard } from './guards/api-key.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionGuard } from './guards/permission.guard';
import { RequireSetupGuard } from './guards/require-setup.guard';
import { TenantScopeGuard } from './guards/tenant-scope.guard';
import { JwtTokenService } from './services/jwt-token.service';

@Module({
  providers: [
    ApiKeyGuard,
    JwtTokenService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: TenantScopeGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RequireSetupGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
  ],
  exports: [ApiKeyGuard, JwtTokenService],
})
export class AuthModule {}
