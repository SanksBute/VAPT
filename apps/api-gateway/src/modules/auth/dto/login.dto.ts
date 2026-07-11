import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, IsOptional, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @ApiProperty({ example: 'john@acme.com' })
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email!: string;

  @ApiProperty({ example: 'SecurePassword@123' })
  @IsString()
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ example: '123456', description: '6-digit MFA code if MFA is enabled' })
  @IsOptional()
  @IsString()
  @Length(6, 8)
  mfaCode?: string;

  @ApiPropertyOptional({ description: 'Device information for session tracking' })
  @IsOptional()
  deviceInfo?: Record<string, unknown>;
}
