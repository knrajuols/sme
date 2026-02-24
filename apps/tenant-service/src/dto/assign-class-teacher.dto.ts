import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AssignClassTeacherDto {
  @ApiProperty({ example: '7b75c5bc-bff7-4afe-a956-d9f9b5fdc08a' })
  @IsString()
  classId!: string;

  @ApiProperty({ example: 'bbf03dca-0893-4b66-81cd-5d7dc96f7397' })
  @IsString()
  sectionId!: string;

  @ApiProperty({ example: '6f88f4a6-1e78-4ed6-b27f-086f13bf6ca0' })
  @IsString()
  teacherId!: string;
}