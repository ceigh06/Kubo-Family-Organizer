import { describe, expect, it } from 'vitest';

import {
  INVITE_ALPHABET,
  INVITE_CODE_LENGTH,
  INVITE_TTL_MS,
  computeExpiry,
  generateInviteCode,
  isExpired,
  normalizeCode,
} from './inviteCode';

describe('generateInviteCode', () => {
  it('returns a code of exactly 6 characters', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateInviteCode()).toHaveLength(INVITE_CODE_LENGTH);
    }
  });

  it('uses only characters from the invite alphabet', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateInviteCode();
      for (const char of code) {
        expect(INVITE_ALPHABET).toContain(char);
      }
    }
  });

  it('never emits ambiguous characters (I, L, O, 0, 1)', () => {
    const forbidden = 'ILO01';
    for (let i = 0; i < 500; i++) {
      const code = generateInviteCode();
      for (const char of code) {
        expect(forbidden).not.toContain(char);
      }
    }
  });

  it('matches the expected format', () => {
    const pattern = new RegExp(`^[${INVITE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`);
    for (let i = 0; i < 100; i++) {
      expect(generateInviteCode()).toMatch(pattern);
    }
  });

  it('does not always generate the same code', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateInviteCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('computeExpiry', () => {
  it('returns an ISO 8601 string 24 hours after the given time', () => {
    const now = new Date('2026-10-09T00:00:00.000Z');
    expect(computeExpiry(now)).toBe('2026-10-10T00:00:00.000Z');
  });

  it('adds exactly the TTL to the given time', () => {
    const now = new Date('2026-03-01T12:30:45.123Z');
    const expiry = new Date(computeExpiry(now));
    expect(expiry.getTime() - now.getTime()).toBe(INVITE_TTL_MS);
  });
});

describe('isExpired', () => {
  const expiresAt = '2026-10-10T00:00:00.000Z';

  it('is not expired before the boundary', () => {
    const oneMsBefore = new Date(new Date(expiresAt).getTime() - 1);
    expect(isExpired(expiresAt, oneMsBefore)).toBe(false);
  });

  it('is expired at the boundary instant', () => {
    expect(isExpired(expiresAt, new Date(expiresAt))).toBe(true);
  });

  it('is expired after the boundary', () => {
    const oneMsAfter = new Date(new Date(expiresAt).getTime() + 1);
    expect(isExpired(expiresAt, oneMsAfter)).toBe(true);
  });

  it('treats a freshly issued code as not expired at issue time', () => {
    const now = new Date('2026-10-09T09:00:00.000Z');
    expect(isExpired(computeExpiry(now), now)).toBe(false);
  });
});

describe('normalizeCode', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeCode('  ABC234  ')).toBe('ABC234');
    expect(normalizeCode('\t\nABC234\n')).toBe('ABC234');
  });

  it('uppercases lowercase input', () => {
    expect(normalizeCode('abc234')).toBe('ABC234');
  });

  it('trims and uppercases together', () => {
    expect(normalizeCode('  abc234 ')).toBe('ABC234');
  });

  it('leaves already-normalized input unchanged', () => {
    expect(normalizeCode('ABC234')).toBe('ABC234');
  });

  it('produces a code comparable to a generated one', () => {
    const code = generateInviteCode();
    expect(normalizeCode(`  ${code.toLowerCase()} `)).toBe(code);
  });
});
