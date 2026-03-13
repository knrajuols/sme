import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class GenerateInvoicesDto {
  @ApiProperty({ example: 'b11f3e4e-2a28-44e2-8b81-400c8d98f241' })
  @IsString()
  academicYearId!: string;

  @ApiProperty({ example: 'c22f3e4e-3b39-55f3-9c92-511d9e09g352' })
  @IsString()
  classId!: string;

  @ApiProperty({ example: 'd33f4e5e-4c4a-66g4-ad03-622eaf1ah463' })
  @IsString()
  feeStructureId!: string;
}
