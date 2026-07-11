import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class VerifyMfaDto {
  @ApiProperty({ example: '123456', description: '6-digit TOTP or verification code' })
  @IsString()
  @Length(6, 8)
  code!: string;
}
