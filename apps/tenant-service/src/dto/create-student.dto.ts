import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsString, MinLength } from 'class-validator';

export class CreateStudentDto {
  @ApiProperty({ example: 'ADM-2026-001' })
  @IsString()
  @MinLength(3)
  admissionNumber!: string;

  @ApiProperty({ example: 'Aarav' })
  @IsString()
  @MinLength(2)
  firstName!: string;

  @ApiProperty({ example: 'Sharma' })
  @IsString()
  @MinLength(2)
  lastName!: string;

  @ApiProperty({ example: '2016-08-10T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  dateOfBirth!: Date;

  @ApiProperty({ example: 'MALE' })
  @IsString()
  gender!: string;

  @ApiProperty({ example: 'ACTIVE', enum: ['ACTIVE', 'INACTIVE'] })
  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: 'ACTIVE' | 'INACTIVE';
}