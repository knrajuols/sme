import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsString } from 'class-validator';

export class CreateAuditEventDto {
  @ApiProperty({ example: 'TENANT_CREATED' })
  @IsString()
  action!: string;

  @ApiProperty({ example: 'admin@sme.local' })
  @IsString()
  actor!: string;

  @ApiProperty({ example: { tenantId: 'f893f9f0-8f3f-4f0f-9240-bf8c49576191' } })
  @IsObject()
  payload!: Record<string, unknown>;
}
