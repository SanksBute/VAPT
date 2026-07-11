import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, MaxLength, IsDate, Min, Max, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'CI/CD Pipeline Key', description: 'Descriptive name for the API key' })
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ type: [String], description: 'List of permission scopes' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @ApiPropertyOptional({ type: [String], description: 'IP addresses allowed to use this key' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedIps?: string[];

  @ApiPropertyOptional({ description: 'Key expiration date' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;

  @ApiPropertyOptional({ example: 100, description: 'Rate limit in requests per minute' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  rateLimitRpm?: number;
}
