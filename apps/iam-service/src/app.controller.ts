import { Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { CurrentTenant, CurrentUser, Permissions, Public } from '@sme/auth';
import type { JwtClaims } from '@sme/auth';

import { AuthTokenRequestDto } from './dto/auth-token-request.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { AppService } from './app.service';

@ApiTags('IAM')
@Controller('iam')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('onboarding/tenants/:tenantId/activate')
  @ApiOperation({ summary: 'Activate onboarding users for tenant after platform approval' })
  @Permissions('TENANT_CREATE')
  async activateTenantOnboarding(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<{ tenantId: string; activatedUsers: Array<{ email: string | null }> }> {
    return this.appService.activateTenantOnboarding(tenantId, user, correlationId);
  }

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'IAM health check with DB ping' })
  async health(): Promise<{ service: string; status: string }> {
    return this.appService.health();
  }

  @Public()
  @Post('auth/token')
  @ApiOperation({ summary: 'Issue access token for user session' })
  async issueToken(
    @Body() dto: AuthTokenRequestDto,
    @Req() req: Request,
  ): Promise<{ accessToken: string; expiresIn: number; claims: JwtClaims }> {
    const ipAddress = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
      ?? req.socket?.remoteAddress
      ?? undefined;
    const userAgent = req.headers['user-agent'];
    return this.appService.issueAccessToken(dto, ipAddress, userAgent);
  }

  @Post('users')
  @ApiOperation({ summary: 'Create IAM user' })
  @Permissions('USER_CREATE')
  async createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: JwtClaims,
    @CurrentTenant() tenantId?: string,
  ): Promise<{ created: boolean; user: CreateUserDto & { tenantId: string } }> {
    return this.appService.createUser(dto, tenantId ?? user.tenantId);
  }

  @Get('users')
  @ApiOperation({ summary: 'List IAM users' })
  @Permissions('USER_CREATE')
  async listUsers(
    @CurrentUser() user: JwtClaims,
    @CurrentTenant() tenantId?: string,
  ): Promise<Array<{ id: string; email: string | null; displayName: string; tenantId: string }>> {
    return this.appService.listUsers(tenantId ?? user.tenantId);
  }

  @Post('users/:userId/roles/:roleCode')
  @ApiOperation({ summary: 'Assign role to IAM user' })
  @Permissions('ROLE_ASSIGN')
  async assignRole(
    @Param('userId') userId: string,
    @Param('roleCode') roleCode: string,
    @CurrentUser() user: JwtClaims,
  ): Promise<{ assigned: boolean; userId: string; roleCode: string }> {
    return this.appService.assignRole(userId, roleCode, user);
  }
}
