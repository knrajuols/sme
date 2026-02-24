import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'admin@sme.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'John Admin' })
  @IsString()
  @MinLength(2)
  fullName!: string;
}
