import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateClassDto {
  @ApiProperty({ example: 'Grade 1' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'G1' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code!: string;

  @ApiProperty({ example: 'b11f3e4e-2a28-44e2-8b81-400c8d98f241' })
  @IsString()
  academicYearId!: string;
}