import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentTenant, CurrentUser, Permissions, Public } from '@sme/auth';
import type { JwtClaims } from '@sme/auth';

import { AuthTokenRequestDto } from './dto/auth-token-request.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { AppService } from './app.service';

@ApiTags('IAM')
@Controller('iam')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'IAM health check with DB ping' })
  async health(): Promise<{ service: string; status: string }> {
    return this.appService.health();
  }

  @Get('internal/health')
  @ApiOperation({ summary: 'IAM internal health endpoint (requires internal secret + JWT)' })
  internalHealth(): { service: string; status: string } {
    return this.appService.live();
  }

  @Public()
  @Post('auth/token')
  @ApiOperation({ summary: 'Issue access token for user session' })
  async issueToken(
    @Body() dto: AuthTokenRequestDto,
  ): Promise<{ accessToken: string; expiresIn: number; claims: JwtClaims }> {
    return this.appService.issueAccessToken(dto);
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
  ): Promise<Array<{ id: string; email: string; fullName: string; tenantId: string | null }>> {
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
