import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PasswordService {
  private readonly SALT_ROUNDS = 12;

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  validateStrength(password: string): {
    valid: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    if (password.length >= 12) score++;
    if (password.length >= 16) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;
    if (password.length >= 20) score++;

    if (password.length < 12) feedback.push('Password should be at least 12 characters');
    if (!/[a-z]/.test(password)) feedback.push('Add lowercase letters');
    if (!/[A-Z]/.test(password)) feedback.push('Add uppercase letters');
    if (!/\d/.test(password)) feedback.push('Add numbers');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      feedback.push('Add special characters');
    }

    const commonPatterns = [
      /^password/i,
      /12345/,
      /qwerty/i,
      /abc123/i,
      /admin/i,
      /letmein/i,
    ];
    for (const pattern of commonPatterns) {
      if (pattern.test(password)) {
        feedback.push('Avoid common password patterns');
        score = Math.max(0, score - 2);
        break;
      }
    }

    return {
      valid: score >= 4,
      score: Math.min(7, score),
      feedback,
    };
  }
}
