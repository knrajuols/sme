import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class StudentMarkEntryDto {
  @ApiProperty({ example: '70aca6ba-500a-48b3-bd86-d39ab30cf1e2' })
  @IsString()
  studentId!: string;

  @ApiProperty({ example: 76 })
  @IsNumber()
  @Min(0)
  marksObtained!: number;

  @ApiPropertyOptional({ example: 'Good performance' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

export class EnterStudentMarksDto {
  @ApiProperty({ example: '69885257-27bd-4f76-88bb-8bbefe7b3be2' })
  @IsString()
  subjectId!: string;

  @ApiProperty({ type: [StudentMarkEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StudentMarkEntryDto)
  marks!: StudentMarkEntryDto[];
}