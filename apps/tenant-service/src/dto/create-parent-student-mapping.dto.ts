import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class CreateParentStudentMappingDto {
  @ApiProperty({ example: 'fa7f3bf2-b4d1-468f-8256-aeeab2f8540a', description: 'Parent ID' })
  @IsString()
  @IsUUID()
  parentId!: string;

  @ApiProperty({ example: 'c3d2e1f0-a1b2-4c3d-8e5f-6a7b8c9d0e1f', description: 'Student ID' })
  @IsString()
  @IsUUID()
  studentId!: string;
}
