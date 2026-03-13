import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

const PAYMENT_METHODS = ['CASH', 'ONLINE', 'CHEQUE', 'DD', 'UPI'] as const;

export class CollectPaymentDto {
  @ApiProperty({ example: 'd33f4e5e-4c4a-66g4-ad03-622eaf1ah463' })
  @IsString()
  invoiceId!: string;

  @ApiProperty({ example: 'e44f5f6f-5d5b-77h5-be14-733fbg2bi574' })
  @IsString()
  studentId!: string;

  @ApiProperty({ example: 1500.0 })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ enum: PAYMENT_METHODS, example: 'CASH' })
  @IsIn(PAYMENT_METHODS)
  paymentMethod!: string;

  @ApiPropertyOptional({ example: 'TXN20250410001' })
  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @ApiPropertyOptional({ example: 'First instalment' })
  @IsOptional()
  @IsString()
  remarks?: string;
}
