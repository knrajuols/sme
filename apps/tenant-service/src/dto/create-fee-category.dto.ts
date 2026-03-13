import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
}
