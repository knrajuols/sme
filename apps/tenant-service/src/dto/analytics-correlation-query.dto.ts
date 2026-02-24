import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AnalyticsCorrelationQueryDto {
  @ApiProperty({ example: 'b6b08462-3b83-44ea-8b56-6a1668110594' })
  @IsString()
  examId!: string;
}
