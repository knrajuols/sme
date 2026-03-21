import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsDateString,
  IsUUID,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Driver ──────────────────────────────────────────────────────────────────

export class CreateDriverDto {
  @ApiProperty() @IsString() @MaxLength(200)
  name!: string;

  @ApiProperty() @IsString() @MaxLength(20)
  mobile!: string;

  @ApiProperty() @IsString() @MaxLength(50)
  licenseNumber!: string;

  @ApiProperty() @IsDateString()
  licenseExpiry!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  badgeNumber?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  badgeExpiry?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  policeVerificationStatus?: string;
}

export class UpdateDriverDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  name?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  mobile?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  licenseNumber?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  licenseExpiry?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  badgeNumber?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  badgeExpiry?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  policeVerificationStatus?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isActive?: boolean;
}

// ── Attendant ───────────────────────────────────────────────────────────────

export class CreateAttendantDto {
  @ApiProperty() @IsString() @MaxLength(200)
  name!: string;

  @ApiProperty() @IsString() @MaxLength(20)
  mobile!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  policeVerificationStatus?: string;
}

export class UpdateAttendantDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  name?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  mobile?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  policeVerificationStatus?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isActive?: boolean;
}

// ── Vehicle ─────────────────────────────────────────────────────────────────

export class CreateVehicleDto {
  @ApiProperty() @IsString() @MaxLength(30)
  registrationNo!: string;

  @ApiProperty() @IsString() @MaxLength(50)
  vehicleType!: string;

  @ApiProperty() @IsInt() @Min(1)
  capacity!: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  fitnessCertificateNo?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  fitnessExpiryDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  insurancePolicyNo?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  insuranceExpiryDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  pucCertificateNo?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  pucExpiryDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  permitNo?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  permitExpiryDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  lastServiceDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  nextServiceDue?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0)
  odometerReading?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  gpsDeviceId?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  cctvInstalled?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  fireExtinguisherAvailable?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  firstAidAvailable?: boolean;
}

export class UpdateVehicleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30)
  registrationNo?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  vehicleType?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  capacity?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  fitnessCertificateNo?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  fitnessExpiryDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  insurancePolicyNo?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  insuranceExpiryDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  pucCertificateNo?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  pucExpiryDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  permitNo?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  permitExpiryDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  lastServiceDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  nextServiceDue?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0)
  odometerReading?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  gpsDeviceId?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  cctvInstalled?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  fireExtinguisherAvailable?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  firstAidAvailable?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isActive?: boolean;
}

// ── Stop ────────────────────────────────────────────────────────────────────

export class CreateStopDto {
  @ApiProperty() @IsString() @MaxLength(200)
  name!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300)
  landmark?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  latitude?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  longitude?: number;
}

export class UpdateStopDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  name?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300)
  landmark?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  latitude?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  longitude?: number;
}

// ── Route Trip (Nested) ─────────────────────────────────────────────────────

export class RouteTripDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID()
  id?: string;

  @ApiProperty() @IsString() @MaxLength(20)
  tripType!: string; // MORNING, EVENING

  @ApiProperty() @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, { message: 'startTime must be in 24-hour HH:mm format (e.g., 07:30 or 14:45)' })
  startTime!: string;

  @ApiProperty() @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, { message: 'endTime must be in 24-hour HH:mm format (e.g., 07:30 or 14:45)' })
  endTime!: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  driverId?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  attendantId?: string;
}

// ── Route Stop (Nested) ─────────────────────────────────────────────────────

export class RouteStopDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID()
  id?: string;

  @ApiProperty() @IsUUID()
  stopId!: string;

  @ApiProperty() @IsInt() @Min(1)
  sequence!: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  distanceKm?: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, { message: 'pickupTime must be in 24-hour HH:mm format (e.g., 07:30 or 14:45)' })
  pickupTime?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, { message: 'dropTime must be in 24-hour HH:mm format (e.g., 07:30 or 14:45)' })
  dropTime?: string;
}

// ── Route (Composite) ───────────────────────────────────────────────────────

export class CreateRouteDto {
  @ApiProperty() @IsString() @MaxLength(20)
  code!: string;

  @ApiProperty() @IsString() @MaxLength(200)
  name!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RouteTripDto)
  trips?: RouteTripDto[];

  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RouteStopDto)
  stops?: RouteStopDto[];
}

export class UpdateRouteDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20)
  code?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  name?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RouteTripDto)
  trips?: RouteTripDto[];

  @ApiPropertyOptional() @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => RouteStopDto)
  stops?: RouteStopDto[];
}
