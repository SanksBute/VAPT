import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { isValidScanTarget } from '@sentinelx/shared';
import {
  IsString,
  IsEnum,
  IsArray,
  IsOptional,
  IsObject,
  IsUUID,
  IsInt,
  Min,
  Max,
  MaxLength,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
} from 'class-validator';

@ValidatorConstraint({ name: 'isValidScanTarget', async: false })
class IsValidScanTargetConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidScanTarget(value);
  }

  defaultMessage(): string {
    return 'Each target must be a valid hostname, IPv4/IPv6 address, or CIDR range';
  }
}

export class CreateScanDto {
  @ApiProperty({ example: 'Production API Scan Q3 2026' })
  @IsString()
  @MaxLength(500)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({
    enum: [
      'DISCOVERY',
      'PORT_SCAN',
      'VULNERABILITY_ASSESSMENT',
      'WEB_APPLICATION',
      'API_SECURITY',
      'CLOUD_SECURITY',
      'CONTAINER_SECURITY',
      'KUBERNETES_SECURITY',
      'AD_SECURITY',
      'CODE_ANALYSIS',
      'SECRET_DETECTION',
      'PENETRATION_TEST',
      'COMPLIANCE',
      'THREAT_INTEL',
      'FULL',
    ],
    example: 'VULNERABILITY_ASSESSMENT',
  })
  @IsEnum([
    'DISCOVERY',
    'PORT_SCAN',
    'VULNERABILITY_ASSESSMENT',
    'WEB_APPLICATION',
    'API_SECURITY',
    'CLOUD_SECURITY',
    'CONTAINER_SECURITY',
    'KUBERNETES_SECURITY',
    'AD_SECURITY',
    'CODE_ANALYSIS',
    'SECRET_DETECTION',
    'PENETRATION_TEST',
    'COMPLIANCE',
    'THREAT_INTEL',
    'FULL',
  ])
  scanType!: string;

  @ApiProperty({ type: [String], example: ['192.168.1.0/24', 'api.example.com'] })
  @IsArray()
  @IsString({ each: true })
  @Validate(IsValidScanTargetConstraint, { each: true })
  targets!: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Validate(IsValidScanTargetConstraint, { each: true })
  excludeTargets?: string[];

  @ApiPropertyOptional({ description: 'Scan profile UUID to use for configuration' })
  @IsOptional()
  @IsUUID()
  profileId?: string;

  @ApiPropertyOptional({ description: 'Project UUID to associate this scan with' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  priority?: number;

  @ApiPropertyOptional({ description: 'Scanner-specific configuration options' })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Authentication credentials for the scan target' })
  @IsOptional()
  @IsObject()
  credentials?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
