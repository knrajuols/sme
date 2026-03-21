import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateTransportAllocationDto {
  @ApiProperty() @IsUUID()
  studentId!: string;

  @ApiProperty() @IsUUID()
  academicYearId!: string;

  @ApiProperty() @IsUUID()
  routeId!: string;

  @ApiProperty() @IsUUID()
  pickupTripId!: string;

  @ApiProperty() @IsUUID()
  pickupStopId!: string;

  @ApiProperty() @IsUUID()
  dropTripId!: string;

  @ApiProperty() @IsUUID()
  dropStopId!: string;

  @ApiProperty() @IsDateString()
  startDate!: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  endDate?: string;
}

export class UpdateTransportAllocationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID()
  routeId?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  pickupTripId?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  pickupStopId?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  dropTripId?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  dropStopId?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  startDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  endDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isActive?: boolean;
}
