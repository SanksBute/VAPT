import { z } from 'zod';

import { ipAddressSchema, cidrSchema } from './common.validators';

/**
 * RFC 1123 hostname/label rules: labels of 1-63 alnum/hyphen chars (no
 * leading/trailing hyphen), joined by dots, 253 chars max overall. The
 * character class excludes every shell metacharacter and whitespace by
 * construction, so this also doubles as an injection guard.
 *
 * The bounded {1,63} quantifiers and the 253-char length check performed
 * before this regex ever runs keep matching linear in input length, so the
 * lookaround here is not exploitable for ReDoS despite the static heuristic.
 */
const HOSTNAME_REGEX =
  // eslint-disable-next-line security/detect-unsafe-regex
  /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(?:\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))*$/;

const IPV6_CIDR_REGEX = /^[0-9a-fA-F:]+\/(?:[0-9]|[1-9][0-9]|1[01][0-9]|12[0-8])$/;

/**
 * Strict allowlist target validator used before any target reaches a scanner
 * command line. Accepts only a bare hostname (RFC 1123), IPv4/IPv6 address,
 * or IPv4/IPv6 CIDR range — nothing else, so shell metacharacters and
 * whitespace can never slip through into an external command.
 */
export function isValidScanTarget(target: string): boolean {
  if (typeof target !== 'string') {
    return false;
  }
  if (target.length === 0 || target.length > 253) {
    return false;
  }
  if (target !== target.trim()) {
    return false;
  }
  if (/\s/.test(target)) {
    return false;
  }

  return (
    ipAddressSchema.safeParse(target).success ||
    cidrSchema.safeParse(target).success ||
    (target.includes(':') && IPV6_CIDR_REGEX.test(target)) ||
    HOSTNAME_REGEX.test(target)
  );
}

export const scanTargetSchema = z.string().min(1).max(253).refine(isValidScanTarget, {
  message: 'Target must be a valid hostname, IPv4/IPv6 address, or CIDR range',
});
