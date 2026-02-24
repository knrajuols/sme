import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateSubjectDto {
  @ApiProperty({ example: 'Mathematics' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: 'MATH' })
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty({ example: '7b75c5bc-bff7-4afe-a956-d9f9b5fdc08a' })
  @IsString()
  classId!: string;
}