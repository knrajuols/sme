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
      parentId: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    return this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        description: string | null;
        parentId: string | null;
        createdAt: Date;
        updatedAt: Date;
      }>
    >`
      SELECT "id", "name", "description", "parentId", "createdAt", "updatedAt"
      FROM "FeeCategory"
      WHERE "tenantId" = ${tenantId} AND "softDelete" = false
      ORDER BY "parentId" NULLS FIRST, "name" ASC
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
        parentId: dto.parentId ?? null,
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
        amount: dto.amount ?? null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
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
        ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
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
    if (structure.amount == null) {
      throw new BadRequestException('[ERR-INV-4002] Fee structure has no amount defined — set an amount before generating invoices');
    }
    const amountNum = Number(structure.amount);

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
          amountDue: amountNum,
          amountPaid: 0,
          status: 'PENDING',
          dueDate: structure.dueDate ?? new Date(),
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

  /**
   * Copies fee categories and fee structures from the MASTER_TEMPLATE partition
   * into the target tenant. Skips categories that already exist by name.
   * Returns counts of created/skipped items.
   */
  async generateFromMaster(
    context: RequestContext,
  ): Promise<{ categoriesCreated: number; categoriesSkipped: number; structuresCreated: number; structuresSkipped: number }> {
    const MASTER = 'MASTER_TEMPLATE';
    const tenantId = context.tenantId;

    // ── Copy Fee Categories (parents first, then children) ─────────────────
    const masterCategories = await this.prisma.feeCategory.findMany({
      where: { tenantId: MASTER, softDelete: false },
      select: { id: true, name: true, description: true, parentId: true },
      orderBy: { parentId: { sort: 'asc', nulls: 'first' } },
    });

    const existingCategories = await this.prisma.feeCategory.findMany({
      where: { tenantId, softDelete: false },
      select: { id: true, name: true, parentId: true },
    });

    const catMap = new Map<string, string>(); // masterId → tenantId
    let categoriesCreated = 0;
    let categoriesSkipped = 0;

    // Process parents first (parentId is null), then children
    const parents = masterCategories.filter((c) => !c.parentId);
    const children = masterCategories.filter((c) => c.parentId);

    for (const mc of [...parents, ...children]) {
      const tenantParentId = mc.parentId ? (catMap.get(mc.parentId) ?? null) : null;
      const existing = existingCategories.find(
        (e) => e.name === mc.name && e.parentId === tenantParentId,
      );
      if (existing) {
        categoriesSkipped++;
        catMap.set(mc.id, existing.id);
        continue;
      }

      const created = await this.prisma.feeCategory.create({
        data: {
          tenantId,
          name: mc.name,
          description: mc.description,
          parentId: tenantParentId,
          createdBy: context.userId,
          updatedBy: context.userId,
        },
        select: { id: true },
      });
      catMap.set(mc.id, created.id);
      categoriesCreated++;
    }

    // ── Copy Fee Structures ──────────────────────────────────────────────────
    const masterStructures = await this.prisma.feeStructure.findMany({
      where: { tenantId: MASTER, softDelete: false },
      select: { id: true, academicYearId: true, classId: true, feeCategoryId: true, amount: true, dueDate: true },
    });

    // Map master academic years/classes to tenant equivalents by name
    const masterYears = await this.prisma.academicYear.findMany({
      where: { tenantId: MASTER, softDelete: false },
      select: { id: true, name: true },
    });
    const tenantYears = await this.prisma.academicYear.findMany({
      where: { tenantId, softDelete: false },
      select: { id: true, name: true },
    });
    const yearMap = new Map<string, string>();
    for (const my of masterYears) {
      const ty = tenantYears.find((t) => t.name === my.name);
      if (ty) yearMap.set(my.id, ty.id);
    }

    // Fetch classes WITH academicYearId so we match by code + year
    const masterClasses = await this.prisma.class.findMany({
      where: { tenantId: MASTER, softDelete: false },
      select: { id: true, code: true, academicYearId: true },
    });
    const tenantClasses = await this.prisma.class.findMany({
      where: { tenantId, softDelete: false },
      select: { id: true, code: true, academicYearId: true },
    });

    // Build a composite map: masterClassId → tenantClassId
    // Match by code AND academic year (via yearMap) to avoid cross-year mismatches
    const classMap = new Map<string, string>();
    for (const mc of masterClasses) {
      const mappedYearId = yearMap.get(mc.academicYearId);
      if (!mappedYearId) continue;
      const tc = tenantClasses.find(
        (t) => t.code === mc.code && t.academicYearId === mappedYearId,
      );
      if (tc) classMap.set(mc.id, tc.id);
    }

    let structuresCreated = 0;
    let structuresSkipped = 0;

    for (const ms of masterStructures) {
      const tenantYearId = yearMap.get(ms.academicYearId);
      const tenantClassId = classMap.get(ms.classId);
      const tenantCatId = catMap.get(ms.feeCategoryId);

      if (!tenantYearId || !tenantClassId || !tenantCatId) {
        structuresSkipped++;
        continue;
      }

      // Check for existing duplicate (unique constraint: tenantId + yearId + classId + catId)
      const exists = await this.prisma.feeStructure.findFirst({
        where: {
          tenantId,
          academicYearId: tenantYearId,
          classId: tenantClassId,
          feeCategoryId: tenantCatId,
          softDelete: false,
        },
        select: { id: true },
      });
      if (exists) {
        structuresSkipped++;
        continue;
      }

      await this.prisma.feeStructure.create({
        data: {
          tenantId,
          academicYearId: tenantYearId,
          classId: tenantClassId,
          feeCategoryId: tenantCatId,
          amount: ms.amount,
          dueDate: ms.dueDate,
          createdBy: context.userId,
          updatedBy: context.userId,
        },
      });
      structuresCreated++;
    }

    await this.publishAudit(
      context,
      'CREATE',
      'FeeCategory',
      'BULK',
      `Generated from master: ${categoriesCreated} categories, ${structuresCreated} structures`,
      { categoriesCreated, categoriesSkipped, structuresCreated, structuresSkipped },
    );

    return { categoriesCreated, categoriesSkipped, structuresCreated, structuresSkipped };
  }

  // ── Seed Fee Structures ────────────────────────────────────────────────────

  /**
   * Seeds fee structures for the MASTER_TEMPLATE tenant by creating one
   * FeeStructure per (FeeCategory × Class) for the active academic year,
   * using standard Indian K-12 fee amounts.
   *
   * Admission Phase (3 items per class):
   *   Registration Fee:                 ₹500   (non-refundable)
   *   Admission Fee:                    ₹5,000
   *   Security Deposit/Caution Deposit: ₹5,000 (refundable)
   *
   * Annual Fees (4 items per class):
   *   Infrastructure/Development Fee:   ₹2,000
   *   Examination Fee:                  ₹1,000
   *   Lab/Library Fee:                  ₹1,000
   *   Student Insurance & Diary:        ₹500
   *
   * Tuition Fee (class-tier based):
   *   Primary (C1-5):      ₹3,500
   *   Middle (C6-8):       ₹4,500
   *   Secondary (C9-10):   ₹5,500
   *   Sr.Secondary (C11-12): ₹6,500
   *
   * Utilities Fee: null (Transport slab-based — school defines)
   *
   * Skips any structure that already exists (idempotent).
   */
  async seedFeeStructures(
    context: RequestContext,
    academicYearId?: string,
  ): Promise<{ created: number; skipped: number }> {
    const tenantId = context.tenantId;

    // ── 1. Resolve Academic Year: use the provided ID or fall back to active ─
    let activeYear: { id: string; name: string } | null = null;

    if (academicYearId) {
      activeYear = await this.prisma.academicYear.findFirst({
        where: { tenantId, id: academicYearId, softDelete: false },
        select: { id: true, name: true },
      });
      if (!activeYear) {
        throw new BadRequestException(
          `[ERR-FS-SEED-4001] Academic Year not found: ${academicYearId}.`,
        );
      }
    } else {
      activeYear = await this.prisma.academicYear.findFirst({
        where: { tenantId, isActive: true, softDelete: false },
        select: { id: true, name: true },
      });
      if (!activeYear) {
        throw new BadRequestException(
          '[ERR-FS-SEED-4001] No active Academic Year found. Please create and activate an Academic Year first.',
        );
      }
    }

    // ── 2. Fee Categories (only leaf items — items with parentId, or standalone parents with no children) ──
    const allCategories = await this.prisma.feeCategory.findMany({
      where: { tenantId, softDelete: false },
      select: { id: true, name: true, parentId: true },
    });
    if (allCategories.length === 0) {
      throw new BadRequestException(
        '[ERR-FS-SEED-4002] No Fee Categories found. Please seed Fee Categories first.',
      );
    }
    // Parent IDs that have children — FeeStructures should NOT link to these
    const parentIdsWithChildren = new Set(
      allCategories.filter((c) => c.parentId).map((c) => c.parentId!),
    );
    // Leaf categories = items (parentId set) + standalone parents (no children)
    const categories = allCategories.filter(
      (c) => c.parentId !== null || !parentIdsWithChildren.has(c.id),
    );

    // ── 3. Classes for the active year ───────────────────────────────────────
    const classes = await this.prisma.class.findMany({
      where: { tenantId, academicYearId: activeYear.id, softDelete: false },
      select: { id: true, code: true },
      orderBy: { code: 'asc' },
    });
    if (classes.length === 0) {
      throw new BadRequestException(
        '[ERR-FS-SEED-4003] No Classes found for the active Academic Year. Please seed Classes first.',
      );
    }

    // ── 4. Amount rules (keyed by category name) ─────────────────────────────
    // Tuition tiers keyed by class code range
    function tuitionAmount(code: string): number | null {
      const num = parseInt(code.replace(/\D/g, ''), 10);
      if (isNaN(num)) return null;
      if (num >= 1 && num <= 5)  return 3500;   // Primary
      if (num >= 6 && num <= 8)  return 4500;   // Middle School
      if (num >= 9 && num <= 10) return 5500;   // Secondary
      if (num >= 11 && num <= 12) return 6500;  // Sr. Secondary
      return null;
    }

    // Flat-amount categories (same for every class)
    const flatAmountMap: Record<string, number | null> = {
      // Admission phase
      'Registration Fee':                 500,
      'Admission Fee':                    5000,
      'Security Deposit/Caution Deposit': 5000,
      // Annual fees
      'Infrastructure/Development Fee':   2000,
      'Examination Fee':                  1000,
      'Lab/Library Fee':                  1000,
      'Student Insurance & Diary':        500,
      // School-defined
      'Utilities Fee':                    null,
    };

    // ── 5. Create structures ─────────────────────────────────────────────────
    let created = 0;
    let skipped = 0;

    for (const cls of classes) {
      for (const cat of categories) {
        // Determine amount: Tuition is class-tier based, others from flat map
        const amount =
          cat.name === 'Tuition Fee'
            ? tuitionAmount(cls.code)
            : (flatAmountMap[cat.name] ?? null);

        // Check for existing record (including soft-deleted)
        const existing = await this.prisma.feeStructure.findFirst({
          where: {
            tenantId,
            academicYearId: activeYear.id,
            classId: cls.id,
            feeCategoryId: cat.id,
          },
          select: { id: true, softDelete: true, amount: true },
        });

        if (existing && !existing.softDelete) {
          skipped++;
          continue;
        }

        if (existing && existing.softDelete) {
          // Reactivate soft-deleted record with correct amount
          await this.prisma.feeStructure.update({
            where: { id: existing.id },
            data: { softDelete: false, amount, updatedBy: context.userId, updatedAt: new Date() },
          });
          created++;
          continue;
        }

        await this.prisma.feeStructure.create({
          data: {
            tenantId,
            academicYearId: activeYear.id,
            classId: cls.id,
            feeCategoryId: cat.id,
            amount,
            dueDate: null,
            createdBy: context.userId,
            updatedBy: context.userId,
          },
        });
        created++;
      }
    }

    await this.publishAudit(
      context,
      'SEED',
      'FeeStructure',
      'BULK',
      `Seeded fee structures for ${activeYear.name}: ${created} created, ${skipped} skipped`,
      { academicYearId: activeYear.id, created, skipped },
    );

    return { created, skipped };
  }

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
