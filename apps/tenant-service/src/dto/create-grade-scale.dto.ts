import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateGradeScaleDto {
  @ApiProperty({ example: 'A+' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'A+' })
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  grade!: string;

  @ApiProperty({ example: 90 })
  @IsNumber()
  @Min(0)
  @Max(100)
  minPercentage!: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  maxPercentage!: number;
}
