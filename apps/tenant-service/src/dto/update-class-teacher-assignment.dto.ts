import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateClassTeacherAssignmentDto {
  @ApiPropertyOptional({ example: '6f88f4a6-1e78-4ed6-b27f-086f13bf6ca0' })
  @IsOptional()
  @IsString()
  teacherId?: string;
}
