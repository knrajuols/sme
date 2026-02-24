import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsString, Matches } from 'class-validator';

export class UpsertConfigurationDto {
  @ApiProperty({ example: 'greenwood-academy' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  tenantCode!: string;

  @ApiProperty({
    example: { gradingSystem: 'GPA', attendanceThreshold: 75 },
  })
  @IsObject()
  payload!: Record<string, unknown>;
}
