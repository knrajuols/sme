import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

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
  @ApiOperation({ summary: 'Audit internal health endpoint (requires internal secret + JWT)' })
  internalHealth(): { service: string; status: string } {
    return this.appService.live();
  }

  @Post('events')
  @ApiOperation({ summary: 'Create audit event' })
  @Permissions('AUDIT_VIEW')
  async create(@Body() dto: CreateAuditEventDto): Promise<{ persisted: boolean; event: CreateAuditEventDto }> {
    return this.appService.create(dto);
  }

  @Get('tenant/:tenantId')
  @ApiOperation({ summary: 'List audit events by tenant ID' })
  @Permissions('AUDIT_VIEW')
  async findByTenantId(
    @Param('tenantId') tenantId: string,
    @CurrentUser() user: JwtClaims,
  ): Promise<Array<{ id: string; action: string; entity: string | null; correlationId: string | null; createdAt: Date }>> {
    return this.appService.findByTenantId(tenantId, user);
  }
}
