import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class EnableMfaDto {
  @ApiProperty({ enum: ['TOTP', 'SMS', 'EMAIL', 'HARDWARE_KEY'] })
  @IsEnum(['TOTP', 'SMS', 'EMAIL', 'HARDWARE_KEY'])
  method!: string;

  @ApiPropertyOptional({ description: 'Phone number for SMS MFA (e.g. +1234567890)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^\+[1-9]\d{1,14}$/, { message: 'Phone number must be in E.164 format' })
  phoneNumber?: string;
}
