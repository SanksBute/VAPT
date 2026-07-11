import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password' })
  @IsString()
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({ description: 'New password (min 12 chars, must include upper, lower, number, special char)' })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/, {
    message: 'Password must contain uppercase, lowercase, number, and special character',
  })
  newPassword!: string;

  @ApiProperty({ description: 'Confirm new password' })
  @IsString()
  confirmPassword!: string;
}
