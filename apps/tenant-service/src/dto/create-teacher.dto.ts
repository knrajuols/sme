import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateTeacherDto {
  @ApiProperty({ example: 'fa7f3bf2-b4d1-468f-8256-aeeab2f8540a' })
  @IsString()
  userId!: string;

  @ApiProperty({ example: 'EMP-1001' })
  @IsString()
  @MinLength(3)
  employeeCode!: string;

  @ApiProperty({ example: 'Senior Teacher' })
  @IsString()
  @MinLength(2)
  designation!: string;
}