import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ example: 'greenwood-academy' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  code!: string;

  @ApiProperty({ example: 'Greenwood Academy' })
  @IsString()
  @MinLength(2)
  name!: string;
}
