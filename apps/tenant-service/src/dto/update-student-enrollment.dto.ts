import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateStudentEnrollmentDto {
  @ApiPropertyOptional({ example: '42' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  rollNumber?: string;
}
