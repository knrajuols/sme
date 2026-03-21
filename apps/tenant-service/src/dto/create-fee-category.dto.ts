import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateFeeCategoryDto {
  @ApiProperty({ example: 'Tuition Fee' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'Monthly tuition fee for all classes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: null, description: 'Parent category ID for line-items; null for top-level categories' })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
