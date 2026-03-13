import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class AuthTokenRequestDto {
  @ApiProperty({ example: 'admin@school.local' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'd840b439-8877-41ff-ab4f-40e029dbad49' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  tenantId?: string;
}