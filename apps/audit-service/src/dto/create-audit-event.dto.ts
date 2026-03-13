import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export enum AuditActorType {
  USER         = 'USER',
  SYSTEM       = 'SYSTEM',
  SCHEDULED_JOB = 'SCHEDULED_JOB',
}

export class CreateAuditEventDto {
  @ApiProperty({ example: 'f893f9f0...' })
  @IsString()
  tenantId!: string;

  @ApiProperty({ example: 'req-corr-123' })
  @IsString()
  correlationId!: string;

  @ApiProperty({ enum: AuditActorType, example: AuditActorType.USER })
  @IsEnum(AuditActorType)
  actorType!: AuditActorType;

  @ApiPropertyOptional({ example: 'user-uuid' })
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional({ example: 'SCHOOL_ADMIN' })
  @IsOptional()
  @IsString()
  actorRole?: string;

  @ApiProperty({ example: 'iam' })
  @IsString()
  moduleKey!: string;

  @ApiProperty({ example: 'User' })
  @IsString()
  entityType!: string;

  @ApiProperty({ example: 'user-uuid' })
  @IsString()
  entityId!: string;

  @ApiProperty({ example: 'CREATE' })
  @IsString()
  action!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  beforeSnapshot?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  afterSnapshot?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'iam-service' })
  @IsOptional()
  @IsString()
  sourceService?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ example: '192.168.1.1' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userAgent?: string;
}
