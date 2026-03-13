import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateFeeCategoryDto {
  @ApiPropertyOptional({ example: 'Tuition Fee' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'Monthly tuition fee for all classes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
