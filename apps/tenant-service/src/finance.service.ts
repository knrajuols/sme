import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import {
  AUDIT_EVENT_REQUESTED_ROUTING_KEY,
  AuditEventRequestedPayload,
  EventEnvelope,
} from '@sme/common';
import { MessagePublisherService } from '@sme/messaging';

import { CreateFeeCategoryDto } from './dto/create-fee-category.dto';
import { UpdateFeeCategoryDto } from './dto/update-fee-category.dto';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { UpdateFeeStructureDto } from './dto/update-fee-structure.dto';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { CollectPaymentDto } from './dto/collect-payment.dto';
import { PrismaService } from './prisma/prisma.service';

interface RequestContext {
  tenantId: string;
  userId: string;
  role: string;
  correlationId: string;
}

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: MessagePublisherService,
  ) {}

  // ── FeeCategory ────────────────────────────────────────────────────────────

  async listFeeCategories(tenantId: string): Promise<
    Array<{
      id: string;
      name: string;
      description: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    return this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
      }>
    >`
      SELECT "id", "name", "description", "createdAt", "updatedAt"
      FROM "FeeCategory"
      WHERE "tenantId" = ${tenantId} AND "softDelete" = false
      ORDER BY "name" ASC
    `;
  }

  async createFeeCategory(
    dto: CreateFeeCategoryDto,
    context: RequestContext,
  ): Promise<{ id: string }> {
    const { id } = await this.prisma.feeCategory.create({
      data: {
        tenantId: context.tenantId,
        name: dto.name,
        description: dto.description ?? null,
        createdBy: context.userId,
        updatedBy: context.userId,
      },
      select: { id: true },
    });

    await this.publishAudit(
      context,
      'CREATE',
      'FeeCategory',
      id,
      'Fee category created',
      { name: dto.name },
    );
    return { id };
  }

  async updateFeeCategory(
    id: string,
    dto: UpdateFeeCategoryDto,
    context: RequestContext,
  ): Promise<{ updated: boolean }> {
    const result = await this.prisma.feeCategory.updateMany({
      where: { id, tenantId: context.tenantId, softDelete: false },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        updatedBy: context.userId,
        updatedAt: new Date(),
      },
    });
    if (result.count === 0) {
      throw new NotFoundException('[ERR-FEE-CAT-4041] Fee category not found');
    }

    await this.publishAudit(
      context,
      'UPDATE',
      'FeeCategory',
      id,
      'Fee category updated',
      { ...dto },
    );
    return { updated: true };
  }

  async deleteFeeCategory(
    id: string,
    context: RequestContext,
  ): Promise<{ deleted: boolean }> {
    const category = await this.prisma.feeCategory.findFirst({
      where: { id, tenantId: context.tenantId, softDelete: false },
      select: { id: true },
    });
    if (!category) {
      throw new NotFoundException('[ERR-FEE-CAT-4042] Fee category not found');
    }

    const linkedStructures = await this.prisma.feeStructure.count({
      where: { feeCategoryId: id, tenantId: context.tenantId, softDelete: false },
    });
    if (linkedStructures > 0) {
      throw new BadRequestException(
        '[ERR-FEE-CAT-4002] Cannot delete a fee category that is assigned to active fee structures',
      );
    }

    await this.prisma.feeCategory.updateMany({
      where: { id, tenantId: context.tenantId },
      data: { softDelete: true, updatedAt: new Date() },
    });

    await this.publishAudit(
      context,
      'DELETE',
      'FeeCategory',
      id,
      'Fee category soft-deleted',
      {},
    );
    return { deleted: true };
  }

  // ── FeeStructure ───────────────────────────────────────────────────────────

  async listFeeStructures(
    tenantId: string,
    filters?: { academicYearId?: string; classId?: string },
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
    const ayFilter =
      filters?.academicYearId != null
        ? this.prisma.$queryRaw<never[]>`AND "academicYearId" = ${filters.academicYearId}`
        : undefined;
    const clFilter =
      filters?.classId != null
        ? this.prisma.$queryRaw<never[]>`AND "classId" = ${filters.classId}`
        : undefined;

    // Use $queryRaw with safe Prisma interpolation; build sub-conditions selectively.
    if (filters?.academicYearId && filters?.classId) {
      return this.prisma.$queryRaw<
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
      >`
        SELECT "id", "academicYearId", "classId", "feeCategoryId", "amount", "dueDate", "createdAt", "updatedAt"
        FROM "FeeStructure"
        WHERE "tenantId" = ${tenantId}
          AND "academicYearId" = ${filters.academicYearId}
          AND "classId" = ${filters.classId}
          AND "softDelete" = false
        ORDER BY "dueDate" ASC
      `;
    }
    if (filters?.academicYearId) {
      return this.prisma.$queryRaw<
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
      >`
        SELECT "id", "academicYearId", "classId", "feeCategoryId", "amount", "dueDate", "createdAt", "updatedAt"
        FROM "FeeStructure"
        WHERE "tenantId" = ${tenantId}
          AND "academicYearId" = ${filters.academicYearId}
          AND "softDelete" = false
        ORDER BY "dueDate" ASC
      `;
    }
    if (filters?.classId) {
      return this.prisma.$queryRaw<
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
      >`
        SELECT "id", "academicYearId", "classId", "feeCategoryId", "amount", "dueDate", "createdAt", "updatedAt"
        FROM "FeeStructure"
        WHERE "tenantId" = ${tenantId}
          AND "classId" = ${filters.classId}
          AND "softDelete" = false
        ORDER BY "dueDate" ASC
      `;
    }

    void ayFilter;
    void clFilter;

    return this.prisma.$queryRaw<
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
    >`
      SELECT "id", "academicYearId", "classId", "feeCategoryId", "amount", "dueDate", "createdAt", "updatedAt"
      FROM "FeeStructure"
      WHERE "tenantId" = ${tenantId} AND "softDelete" = false
      ORDER BY "dueDate" ASC
    `;
  }

  async createFeeStructure(
    dto: CreateFeeStructureDto,
    context: RequestContext,
  ): Promise<{ id: string }> {
    await this.assertEntityExists(
      'AcademicYear',
      dto.academicYearId,
      context.tenantId,
    );
    await this.assertEntityExists('Class', dto.classId, context.tenantId);
    await this.assertEntityExists(
      'FeeCategory',
      dto.feeCategoryId,
      context.tenantId,
    );

    const { id } = await this.prisma.feeStructure.create({
      data: {
        tenantId: context.tenantId,
        academicYearId: dto.academicYearId,
        classId: dto.classId,
        feeCategoryId: dto.feeCategoryId,
        amount: dto.amount,
        dueDate: new Date(dto.dueDate),
        createdBy: context.userId,
        updatedBy: context.userId,
      },
      select: { id: true },
    });

    await this.publishAudit(
      context,
      'CREATE',
      'FeeStructure',
      id,
      'Fee structure created',
      { classId: dto.classId, feeCategoryId: dto.feeCategoryId, amount: dto.amount },
    );
    return { id };
  }

  async updateFeeStructure(
    id: string,
    dto: UpdateFeeStructureDto,
    context: RequestContext,
  ): Promise<{ updated: boolean }> {
    if (dto.academicYearId) {
      await this.assertEntityExists(
        'AcademicYear',
        dto.academicYearId,
        context.tenantId,
      );
    }
    if (dto.classId) {
      await this.assertEntityExists('Class', dto.classId, context.tenantId);
    }
    if (dto.feeCategoryId) {
      await this.assertEntityExists(
        'FeeCategory',
        dto.feeCategoryId,
        context.tenantId,
      );
    }

    const result = await this.prisma.feeStructure.updateMany({
      where: { id, tenantId: context.tenantId, softDelete: false },
      data: {
        ...(dto.academicYearId !== undefined && {
          academicYearId: dto.academicYearId,
        }),
        ...(dto.classId !== undefined && { classId: dto.classId }),
        ...(dto.feeCategoryId !== undefined && {
          feeCategoryId: dto.feeCategoryId,
        }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
        updatedBy: context.userId,
        updatedAt: new Date(),
      },
    });
    if (result.count === 0) {
      throw new NotFoundException('[ERR-FEE-STRUCT-4041] Fee structure not found');
    }

    await this.publishAudit(
      context,
      'UPDATE',
      'FeeStructure',
      id,
      'Fee structure updated',
      { ...dto },
    );
    return { updated: true };
  }

  async deleteFeeStructure(
    id: string,
    context: RequestContext,
  ): Promise<{ deleted: boolean }> {
    const structure = await this.prisma.feeStructure.findFirst({
      where: { id, tenantId: context.tenantId, softDelete: false },
      select: { id: true },
    });
    if (!structure) {
      throw new NotFoundException('[ERR-FEE-STRUCT-4042] Fee structure not found');
    }

    const linkedInvoices = await this.prisma.feeInvoice.count({
      where: { feeStructureId: id, tenantId: context.tenantId, softDelete: false },
    });
    if (linkedInvoices > 0) {
      throw new BadRequestException(
        '[ERR-FEE-STRUCT-4002] Cannot delete a fee structure that has active invoices',
      );
    }

    await this.prisma.feeStructure.updateMany({
      where: { id, tenantId: context.tenantId },
      data: { softDelete: true, updatedAt: new Date() },
    });

    await this.publishAudit(
      context,
      'DELETE',
      'FeeStructure',
      id,
      'Fee structure soft-deleted',
      {},
    );
    return { deleted: true };
  }

  // ── Invoices ───────────────────────────────────────────────────────────────

  async generateInvoices(
    dto: GenerateInvoicesDto,
    context: RequestContext,
  ): Promise<{ created: number; skipped: number }> {
    // Validate the fee structure belongs to this tenant and resolve amountDue.
    const structures = await this.prisma.feeStructure.findMany({
      where: { id: dto.feeStructureId, tenantId: context.tenantId, softDelete: false },
      select: { id: true, amount: true, dueDate: true },
    });
    if (structures.length === 0) {
      throw new NotFoundException('[ERR-INV-4041] Fee structure not found');
    }
    const structure = structures[0];

    // Fetch all active enrollments for the class+year.
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        tenantId: context.tenantId,
        classId: dto.classId,
        academicYearId: dto.academicYearId,
        softDelete: false,
      },
      select: { studentId: true },
    });
    if (enrollments.length === 0) {
      throw new BadRequestException('[ERR-INV-4001] No active enrollments found for this class and academic year');
    }

    const studentIds = enrollments.map((e) => e.studentId);

    // Skip students who already have an invoice for this fee structure.
    const existing = await this.prisma.feeInvoice.findMany({
      where: {
        tenantId: context.tenantId,
        feeStructureId: dto.feeStructureId,
        studentId: { in: studentIds },
        softDelete: false,
      },
      select: { studentId: true },
    });
    const alreadyInvoiced = new Set(existing.map((i) => i.studentId));
    const toCreate = studentIds.filter((sid) => !alreadyInvoiced.has(sid));

    if (toCreate.length === 0) {
      return { created: 0, skipped: studentIds.length };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.feeInvoice.createMany({
        data: toCreate.map((studentId) => ({
          tenantId: context.tenantId,
          studentId,
          feeStructureId: dto.feeStructureId,
          amountDue: structure.amount,
          amountPaid: 0,
          status: 'PENDING',
          dueDate: structure.dueDate,
          createdBy: context.userId,
          updatedBy: context.userId,
        })),
      });
    });

    await this.publishAudit(
      context,
      'CREATE',
      'FeeInvoice',
      dto.feeStructureId,
      `Bulk invoices generated: ${toCreate.length} created, ${alreadyInvoiced.size} skipped`,
      { classId: dto.classId, feeStructureId: dto.feeStructureId, created: toCreate.length },
    );

    return { created: toCreate.length, skipped: alreadyInvoiced.size };
  }

  async listInvoices(
    tenantId: string,
    filters: { classId?: string; studentId?: string },
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
    type InvoiceRow = {
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
    };

    if (filters.studentId) {
      return this.prisma.$queryRaw<InvoiceRow[]>`
        SELECT
          i."id",
          i."studentId",
          (s."firstName" || ' ' || s."lastName") AS "studentName",
          i."feeStructureId",
          fc."name" AS "categoryName",
          i."amountDue",
          i."amountPaid",
          i."status",
          i."dueDate",
          i."createdAt"
        FROM "FeeInvoice" i
        JOIN "Student" s ON s."id" = i."studentId"
        JOIN "FeeStructure" fs ON fs."id" = i."feeStructureId"
        JOIN "FeeCategory" fc ON fc."id" = fs."feeCategoryId"
        WHERE i."tenantId" = ${tenantId}
          AND i."studentId" = ${filters.studentId}
          AND i."softDelete" = false
        ORDER BY i."dueDate" ASC
      `;
    }

    if (filters.classId) {
      return this.prisma.$queryRaw<InvoiceRow[]>`
        SELECT
          i."id",
          i."studentId",
          (s."firstName" || ' ' || s."lastName") AS "studentName",
          i."feeStructureId",
          fc."name" AS "categoryName",
          i."amountDue",
          i."amountPaid",
          i."status",
          i."dueDate",
          i."createdAt"
        FROM "FeeInvoice" i
        JOIN "Student" s ON s."id" = i."studentId"
        JOIN "FeeStructure" fs ON fs."id" = i."feeStructureId"
        JOIN "FeeCategory" fc ON fc."id" = fs."feeCategoryId"
        JOIN "StudentEnrollment" se ON se."studentId" = i."studentId"
          AND se."tenantId" = i."tenantId"
          AND se."softDelete" = false
        WHERE i."tenantId" = ${tenantId}
          AND se."classId" = ${filters.classId}
          AND i."softDelete" = false
        ORDER BY s."lastName" ASC, s."firstName" ASC, i."dueDate" ASC
      `;
    }

    return this.prisma.$queryRaw<InvoiceRow[]>`
      SELECT
        i."id",
        i."studentId",
        (s."firstName" || ' ' || s."lastName") AS "studentName",
        i."feeStructureId",
        fc."name" AS "categoryName",
        i."amountDue",
        i."amountPaid",
        i."status",
        i."dueDate",
        i."createdAt"
      FROM "FeeInvoice" i
      JOIN "Student" s ON s."id" = i."studentId"
      JOIN "FeeStructure" fs ON fs."id" = i."feeStructureId"
      JOIN "FeeCategory" fc ON fc."id" = fs."feeCategoryId"
      WHERE i."tenantId" = ${tenantId}
        AND i."softDelete" = false
      ORDER BY i."dueDate" ASC
    `;
  }

  // ── Payment Collection ─────────────────────────────────────────────────────

  async collectPayment(
    dto: CollectPaymentDto,
    context: RequestContext,
  ): Promise<{ paymentId: string; newStatus: string; newAmountPaid: number }> {
    const invoice = await this.prisma.feeInvoice.findFirst({
      where: {
        id: dto.invoiceId,
        tenantId: context.tenantId,
        studentId: dto.studentId,
        softDelete: false,
      },
      select: { id: true, amountDue: true, amountPaid: true, status: true },
    });
    if (!invoice) {
      throw new NotFoundException('[ERR-PAY-4041] Invoice not found or does not belong to this student');
    }
    if (invoice.status === 'PAID' || invoice.status === 'WAIVED') {
      throw new BadRequestException(`[ERR-PAY-4001] Invoice is already ${invoice.status} — no further payment accepted`);
    }

    const newAmountPaid = Number(invoice.amountPaid) + dto.amount;
    const newStatus = newAmountPaid >= Number(invoice.amountDue) ? 'PAID' : 'PARTIAL';

    // ── ATOMIC: FeePayment create + FeeInvoice update in one transaction ──────
    const payment = await this.prisma.$transaction(async (tx) => {
      const p = await tx.feePayment.create({
        data: {
          tenantId: context.tenantId,
          invoiceId: dto.invoiceId,
          studentId: dto.studentId,
          amount: dto.amount,
          paymentDate: new Date(),
          paymentMethod: dto.paymentMethod,
          referenceNumber: dto.referenceNumber ?? null,
          remarks: dto.remarks ?? null,
          createdBy: context.userId,
          updatedBy: context.userId,
        },
        select: { id: true },
      });

      await tx.feeInvoice.update({
        where: { id: dto.invoiceId },
        data: {
          amountPaid: newAmountPaid,
          status: newStatus,
          updatedBy: context.userId,
          updatedAt: new Date(),
        },
      });

      return p;
    });
    // ─────────────────────────────────────────────────────────────────────────

    await this.publishAudit(
      context,
      'CREATE',
      'FeePayment',
      payment.id,
      `Payment collected: ${dto.amount} via ${dto.paymentMethod}`,
      {
        invoiceId: dto.invoiceId,
        studentId: dto.studentId,
        amount: dto.amount,
        newStatus,
      },
    );

    return { paymentId: payment.id, newStatus, newAmountPaid };
  }
  // ── Payment Receipt ──────────────────────────────────────────────────────────────

  async getPaymentReceipt(id: string, tenantId: string) {
    const payment = await this.prisma.feePayment.findFirst({
      where: { id, tenantId, softDelete: false },
      select: {
        id:              true,
        tenantId:        true,
        invoiceId:       true,
        studentId:       true,
        amount:          true,
        paymentDate:     true,
        paymentMethod:   true,
        referenceNumber: true,
        remarks:         true,
        createdAt:       true,
        student: {
          select: {
            id:              true,
            firstName:       true,
            lastName:        true,
            admissionNumber: true,
          },
        },
        invoice: {
          select: {
            id:          true,
            amountDue:   true,
            amountPaid:  true,
            status:      true,
            dueDate:     true,
            feeStructure: {
              select: {
                id:          true,
                amount:      true,
                feeCategory: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('[ERR-RCP-4041] Payment receipt not found or does not belong to this tenant');
    }

    return payment;
  }
  // ── Shared helpers ─────────────────────────────────────────────────────────

  private async assertEntityExists(
    tableName: string,
    id: string,
    tenantId: string,
  ): Promise<void> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "${tableName}" WHERE "id" = $1 AND "tenantId" = $2 AND "softDelete" = false LIMIT 1`,
      id,
      tenantId,
    );
    if (rows.length === 0) {
      throw new NotFoundException(`${tableName} not found for tenant scope`);
    }
  }

  private async publishAudit(
    context: RequestContext,
    action: string,
    entity: string,
    entityId: string,
    summary: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const payload: AuditEventRequestedPayload = {
      action,
      entity,
      entityId,
      summary,
      metadata,
    };

    const envelope: EventEnvelope<AuditEventRequestedPayload> = {
      eventId: randomUUID(),
      eventType: AUDIT_EVENT_REQUESTED_ROUTING_KEY,
      eventVersion: '1.0.0',
      tenantId: context.tenantId,
      occurredAt: new Date().toISOString(),
      correlationId: context.correlationId,
      producer: { service: 'tenant-service' },
      actor: {
        actorType: 'USER',
        actorId: context.userId,
        role: context.role,
      },
      payload,
    };

    await this.publisher.publish(AUDIT_EVENT_REQUESTED_ROUTING_KEY, envelope);
  }
}
