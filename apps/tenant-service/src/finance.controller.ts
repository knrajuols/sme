import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';

import { CurrentTenant, CurrentUser } from '@sme/auth';
import type { JwtClaims } from '@sme/auth';

import { Roles } from './auth/roles.decorator';
import { RolesGuard } from './auth/roles.guard';

import { FinanceService } from './finance.service';
import { CreateFeeCategoryDto } from './dto/create-fee-category.dto';
import { UpdateFeeCategoryDto } from './dto/update-fee-category.dto';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { UpdateFeeStructureDto } from './dto/update-fee-structure.dto';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { CollectPaymentDto } from './dto/collect-payment.dto';

@ApiTags('Finance')
@Controller('finance')
@UseGuards(RolesGuard)
@Roles('SCHOOL_ADMIN')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // ── Fee Categories ─────────────────────────────────────────────────────────

  @Get('fee-categories')
  @ApiOperation({ summary: 'List fee categories for tenant' })
  async listFeeCategories(
    @CurrentTenant() tenantId: string,
  ): Promise<
    Array<{
      id: string;
      name: string;
      description: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    return this.financeService.listFeeCategories(tenantId);
  }

  @Post('fee-categories')
  @ApiOperation({ summary: 'Create fee category' })
  async createFeeCategory(
    @Body() dto: CreateFeeCategoryDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.financeService.createFeeCategory(dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Patch('fee-categories/:id')
  @ApiOperation({ summary: 'Update fee category' })
  async updateFeeCategory(
    @Param('id') id: string,
    @Body() dto: UpdateFeeCategoryDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean }> {
    return this.financeService.updateFeeCategory(id, dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('fee-categories/:id')
  @ApiOperation({ summary: 'Soft-delete fee category' })
  async deleteFeeCategory(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.financeService.deleteFeeCategory(id, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  // ── Fee Structures ─────────────────────────────────────────────────────────

  @Get('fee-structures')
  @ApiOperation({
    summary:
      'List fee structures for tenant (optionally filtered by academicYearId / classId)',
  })
  async listFeeStructures(
    @CurrentTenant() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('classId') classId?: string,
  ): Promise<
    Array<{
      id: string;
      academicYearId: string;
      classId: string;
      feeCategoryId: string;
      amount: number;
      dueDate: Date;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    return this.financeService.listFeeStructures(tenantId, {
      academicYearId,
      classId,
    });
  }

  @Post('fee-structures')
  @ApiOperation({ summary: 'Create fee structure' })
  async createFeeStructure(
    @Body() dto: CreateFeeStructureDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ id: string }> {
    return this.financeService.createFeeStructure(dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Patch('fee-structures/:id')
  @ApiOperation({ summary: 'Update fee structure' })
  async updateFeeStructure(
    @Param('id') id: string,
    @Body() dto: UpdateFeeStructureDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ updated: boolean }> {
    return this.financeService.updateFeeStructure(id, dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Delete('fee-structures/:id')
  @ApiOperation({ summary: 'Soft-delete fee structure' })
  async deleteFeeStructure(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ deleted: boolean }> {
    return this.financeService.deleteFeeStructure(id, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  // ── Invoices ───────────────────────────────────────────────────────────────

  @Post('invoices/generate')
  @ApiOperation({ summary: 'Bulk-generate invoices for all students enrolled in a class' })
  async generateInvoices(
    @Body() dto: GenerateInvoicesDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ created: number; skipped: number }> {
    return this.financeService.generateInvoices(dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Get('invoices')
  @ApiOperation({ summary: 'List invoices, optionally filtered by classId or studentId' })
  async listInvoices(
    @CurrentTenant() tenantId: string,
    @Query('classId') classId?: string,
    @Query('studentId') studentId?: string,
  ): Promise<
    Array<{
      id: string;
      studentId: string;
      studentName: string;
      feeStructureId: string;
      categoryName: string;
      amountDue: number;
      amountPaid: number;
      status: string;
      dueDate: Date;
      createdAt: Date;
    }>
  > {
    return this.financeService.listInvoices(tenantId, { classId, studentId });
  }

  // ── Payments ───────────────────────────────────────────────────────────────

  @Post('payments')
  @ApiOperation({ summary: 'Collect a fee payment against an invoice (atomic)' })
  async collectPayment(
    @Body() dto: CollectPaymentDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: JwtClaims,
    @Headers('x-correlation-id') correlationIdHeader?: string,
  ): Promise<{ paymentId: string; newStatus: string; newAmountPaid: number }> {
    return this.financeService.collectPayment(dto, {
      tenantId,
      userId: user.sub,
      role: user.roles[0] ?? 'USER',
      correlationId: correlationIdHeader ?? randomUUID(),
    });
  }

  @Get('payments/:id')
  @ApiOperation({ summary: 'Fetch a payment receipt by payment ID' })
  async getPaymentReceipt(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.financeService.getPaymentReceipt(id, tenantId);
  }
}
