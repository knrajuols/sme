import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateClassSectionDto {
  @ApiProperty({ example: '7b75c5bc-bff7-4afe-a956-d9f9b5fdc08a' })
  @IsString()
  classId!: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsString()
  sectionId!: string;

  @ApiProperty({ example: '10-A' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
}
