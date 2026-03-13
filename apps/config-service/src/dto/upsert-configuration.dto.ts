import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsString, Matches } from 'class-validator';

export class UpsertConfigurationDto {
  @ApiProperty({ example: 'GRADING', description: 'Config category (e.g. GRADING, ACADEMIC, WORKFLOW)' })
  @IsString()
  @Matches(/^[A-Z_]+$/)
  configType!: string;

  @ApiProperty({ example: 'default', description: 'Config key within the type' })
  @IsString()
  configKey!: string;

  @ApiProperty({
    example: { scale: 'A-F', passMark: 40 },
    description: 'Config payload (arbitrary JSON)',
  })
  @IsObject()
  payload!: Record<string, unknown>;
}
