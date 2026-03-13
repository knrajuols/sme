import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum NamingStyle {
  ALPHABETIC = 'ALPHABETIC',
  THEMATIC   = 'THEMATIC',
}

export class SeedSectionsDto {
  @ApiProperty({
    enum: NamingStyle,
    example: NamingStyle.ALPHABETIC,
    description: 'ALPHABETIC → "Section A…J", THEMATIC → Indian river/deity names',
  })
  @IsEnum(NamingStyle)
  namingStyle!: NamingStyle;
}
