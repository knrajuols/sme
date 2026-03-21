import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';

import { CurrentUser, Permissions } from '@sme/auth';
import type { JwtClaims } from '@sme/auth';

import { Roles } from './auth/roles.decorator';
import { RolesGuard } from './auth/roles.guard';
import { TransportService } from './transport.service';
import {
  CreateDriverDto,
  UpdateDriverDto,
  CreateAttendantDto,
  UpdateAttendantDto,
  CreateVehicleDto,
  UpdateVehicleDto,
  CreateStopDto,
  UpdateStopDto,
  CreateRouteDto,
  UpdateRouteDto,
} from './dto/transport.dto';

const MASTER_TEMPLATE = 'MASTER_TEMPLATE';

function ctx(user: JwtClaims, correlationIdHeader?: string) {
  return {
    tenantId: MASTER_TEMPLATE,
    userId: user.sub,
    role: user.roles[0] ?? 'PLATFORM_ADMIN',
    correlationId: correlationIdHeader ?? randomUUID(),
  };
}

@ApiTags('Transport')
@Controller('web-admin/transport')
@UseGuards(RolesGuard)
@Roles('PLATFORM_ADMIN')
export class TransportController {
  constructor(private readonly transportService: TransportService) {}

  // ── Drivers ───────────────────────────────────────────────────────────────

  @Get('drivers')
  @ApiOperation({ summary: 'List all drivers' })
  @Permissions('TENANT_CREATE')
  async listDrivers() {
    return this.transportService.listDrivers(MASTER_TEMPLATE);
  }

  @Post('drivers')
  @ApiOperation({ summary: 'Create a driver' })
  @Permissions('TENANT_CREATE')
  async createDriver(
    @Body() dto: CreateDriverDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') cid?: string,
  ): Promise<{ id: string }> {
    return this.transportService.createDriver(dto, ctx(user, cid));
  }

  @Patch('drivers/:id')
  @ApiOperation({ summary: 'Update a driver' })
  @Permissions('TENANT_CREATE')
  async updateDriver(
    @Param('id') id: string,
    @Body() dto: UpdateDriverDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') cid?: string,
  ): Promise<{ updated: boolean }> {
    return this.transportService.updateDriver(id, dto, ctx(user, cid));
  }

  @Delete('drivers/:id')
  @ApiOperation({ summary: 'Soft-delete a driver' })
  @Permissions('TENANT_CREATE')
  async deleteDriver(
    @Param('id') id: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') cid?: string,
  ): Promise<{ deleted: boolean }> {
    return this.transportService.deleteDriver(id, ctx(user, cid));
  }

  // ── Attendants ────────────────────────────────────────────────────────────

  @Get('attendants')
  @ApiOperation({ summary: 'List all attendants' })
  @Permissions('TENANT_CREATE')
  async listAttendants() {
    return this.transportService.listAttendants(MASTER_TEMPLATE);
  }

  @Post('attendants')
  @ApiOperation({ summary: 'Create an attendant' })
  @Permissions('TENANT_CREATE')
  async createAttendant(
    @Body() dto: CreateAttendantDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') cid?: string,
  ): Promise<{ id: string }> {
    return this.transportService.createAttendant(dto, ctx(user, cid));
  }

  @Patch('attendants/:id')
  @ApiOperation({ summary: 'Update an attendant' })
  @Permissions('TENANT_CREATE')
  async updateAttendant(
    @Param('id') id: string,
    @Body() dto: UpdateAttendantDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') cid?: string,
  ): Promise<{ updated: boolean }> {
    return this.transportService.updateAttendant(id, dto, ctx(user, cid));
  }

  @Delete('attendants/:id')
  @ApiOperation({ summary: 'Soft-delete an attendant' })
  @Permissions('TENANT_CREATE')
  async deleteAttendant(
    @Param('id') id: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') cid?: string,
  ): Promise<{ deleted: boolean }> {
    return this.transportService.deleteAttendant(id, ctx(user, cid));
  }

  // ── Vehicles ──────────────────────────────────────────────────────────────

  @Get('vehicles')
  @ApiOperation({ summary: 'List all vehicles' })
  @Permissions('TENANT_CREATE')
  async listVehicles() {
    return this.transportService.listVehicles(MASTER_TEMPLATE);
  }

  @Post('vehicles')
  @ApiOperation({ summary: 'Create a vehicle' })
  @Permissions('TENANT_CREATE')
  async createVehicle(
    @Body() dto: CreateVehicleDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') cid?: string,
  ): Promise<{ id: string }> {
    return this.transportService.createVehicle(dto, ctx(user, cid));
  }

  @Patch('vehicles/:id')
  @ApiOperation({ summary: 'Update a vehicle' })
  @Permissions('TENANT_CREATE')
  async updateVehicle(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') cid?: string,
  ): Promise<{ updated: boolean }> {
    return this.transportService.updateVehicle(id, dto, ctx(user, cid));
  }

  @Delete('vehicles/:id')
  @ApiOperation({ summary: 'Soft-delete a vehicle' })
  @Permissions('TENANT_CREATE')
  async deleteVehicle(
    @Param('id') id: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') cid?: string,
  ): Promise<{ deleted: boolean }> {
    return this.transportService.deleteVehicle(id, ctx(user, cid));
  }

  // ── Stops ─────────────────────────────────────────────────────────────────

  @Get('stops')
  @ApiOperation({ summary: 'List all stops' })
  @Permissions('TENANT_CREATE')
  async listStops() {
    return this.transportService.listStops(MASTER_TEMPLATE);
  }

  @Post('stops')
  @ApiOperation({ summary: 'Create a stop' })
  @Permissions('TENANT_CREATE')
  async createStop(
    @Body() dto: CreateStopDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') cid?: string,
  ): Promise<{ id: string }> {
    return this.transportService.createStop(dto, ctx(user, cid));
  }

  @Patch('stops/:id')
  @ApiOperation({ summary: 'Update a stop' })
  @Permissions('TENANT_CREATE')
  async updateStop(
    @Param('id') id: string,
    @Body() dto: UpdateStopDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') cid?: string,
  ): Promise<{ updated: boolean }> {
    return this.transportService.updateStop(id, dto, ctx(user, cid));
  }

  @Delete('stops/:id')
  @ApiOperation({ summary: 'Soft-delete a stop' })
  @Permissions('TENANT_CREATE')
  async deleteStop(
    @Param('id') id: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') cid?: string,
  ): Promise<{ deleted: boolean }> {
    return this.transportService.deleteStop(id, ctx(user, cid));
  }

  // ── Routes ────────────────────────────────────────────────────────────────

  @Get('routes')
  @ApiOperation({ summary: 'List all routes with trips and stops' })
  @Permissions('TENANT_CREATE')
  async listRoutes() {
    return this.transportService.listRoutes(MASTER_TEMPLATE);
  }

  @Get('routes/:id')
  @ApiOperation({ summary: 'Get a single route with trips and stops' })
  @Permissions('TENANT_CREATE')
  async getRoute(@Param('id') id: string) {
    return this.transportService.getRoute(id, MASTER_TEMPLATE);
  }

  @Post('routes')
  @ApiOperation({ summary: 'Create a route with optional trips & stops' })
  @Permissions('TENANT_CREATE')
  async createRoute(
    @Body() dto: CreateRouteDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') cid?: string,
  ): Promise<{ id: string }> {
    return this.transportService.createRoute(dto, ctx(user, cid));
  }

  @Put('routes/:id')
  @ApiOperation({ summary: 'Save route with trips and stops (full overwrite of children)' })
  @Permissions('TENANT_CREATE')
  async saveRoute(
    @Param('id') id: string,
    @Body() dto: UpdateRouteDto,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') cid?: string,
  ): Promise<{ updated: boolean }> {
    return this.transportService.saveRouteWithTripsAndStops(id, dto, ctx(user, cid));
  }

  @Delete('routes/:id')
  @ApiOperation({ summary: 'Soft-delete a route and its children' })
  @Permissions('TENANT_CREATE')
  async deleteRoute(
    @Param('id') id: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') cid?: string,
  ): Promise<{ deleted: boolean }> {
    return this.transportService.deleteRoute(id, ctx(user, cid));
  }
}
