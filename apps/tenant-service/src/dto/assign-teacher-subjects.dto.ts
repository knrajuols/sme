import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsString, IsUUID } from 'class-validator';

export class AssignTeacherSubjectsDto {
  @ApiProperty({
    example: ['uuid-subject-1', 'uuid-subject-2'],
    description: 'Array of Subject IDs to assign to the teacher (must belong to same tenant)',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsUUID(undefined, { each: true })
  subjectIds!: string[];
}
