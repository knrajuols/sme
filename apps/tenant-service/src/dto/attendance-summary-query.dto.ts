import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AttendanceSummaryQueryDto {
  @ApiProperty({ example: '2026-03-01' })
  @IsString()
  from!: string;

  @ApiProperty({ example: '2026-03-31' })
  @IsString()
  to!: string;
}