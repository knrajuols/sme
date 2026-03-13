import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Permissions, Public } from '@sme/auth';
import type { JwtClaims } from '@sme/auth';

import { AppService } from './app.service';
import { CreateAuditEventDto } from './dto/create-audit-event.dto';

@ApiTags('Audit')
@Controller('audits')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Audit service health check with DB ping' })
  async health(): Promise<{ service: string; status: string }> {
    return this.appService.health();
  }

  @Get('/internal/health')
  @ApiOperation({ summary: 'Audit internal health endpoint (requires JWT)' })
  internalHealth(): { service: string; status: string } {
    return this.appService.live();
  }

  @Post('events')
  @ApiOperation({ summary: 'Create audit event directly via REST' })
  @Permissions('AUDIT_VIEW')
  async create(@Body() dto: CreateAuditEventDto): Promise<{ persisted: boolean; event: CreateAuditEventDto }> {
    return this.appService.create(dto);
  }

  @Get('tenant/:tenantId')
  @ApiOperation({ summary: 'List audit events for a tenant (descending by time)' })
  @ApiQuery({ name: 'limit',  required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @Permissions('AUDIT_VIEW')
  async findByTenantId(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Query('limit')  limit  = 100,
    @Query('offset') offset = 0,
  ) {
    return this.appService.findByTenantId(tenantId, user, Number(limit), Number(offset));
  }
}

