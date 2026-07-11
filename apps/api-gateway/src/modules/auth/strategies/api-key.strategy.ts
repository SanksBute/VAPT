import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { HeaderAPIKeyStrategy } from 'passport-headerapikey';
import { createHash } from 'crypto';
import { AuthService } from '../auth.service';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(HeaderAPIKeyStrategy, 'api-key') {
  constructor(private readonly authService: AuthService) {
    super({ header: 'X-API-Key', prefix: '' }, true);
  }

  async validate(apiKey: string): Promise<unknown> {
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const context = await this.authService.validateApiKey(keyHash);

    if (!context) {
      throw new UnauthorizedException('Invalid API key');
    }

    return context;
  }
}
