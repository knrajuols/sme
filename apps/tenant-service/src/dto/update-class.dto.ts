import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateClassDto {
  @ApiPropertyOptional({ example: 'Grade 1' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'G1' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code?: string;
}
