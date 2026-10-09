/**
 * Invite code helpers for the household feature.
 *
 * Pure TypeScript: no React, no Dexie, no side effects beyond the RNG used by
 * generateInviteCode. Times are handled as ISO 8601 strings on stored rows; the
 * `now` arguments are Date objects supplied by the caller.
 */

/** Ambiguous characters (I, L, O, 0, 1) are excluded for readability. */
export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const INVITE_CODE_LENGTH = 6;

/** Codes expire 24 hours after they are issued. */
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Generate a new invite code: 6 characters drawn from INVITE_ALPHABET.
 * Uses rejection sampling so every symbol is equally likely (no modulo bias).
 */
export function generateInviteCode(): string {
  const alphabetLength = INVITE_ALPHABET.length;
  const maxValid = Math.floor(0x100000000 / alphabetLength) * alphabetLength;

  let code = '';
  while (code.length < INVITE_CODE_LENGTH) {
    const values = new Uint32Array(INVITE_CODE_LENGTH - code.length);
    crypto.getRandomValues(values);
    for (const value of values) {
      if (value >= maxValid) continue; // reject to keep the distribution uniform
      code += INVITE_ALPHABET[value % alphabetLength];
      if (code.length === INVITE_CODE_LENGTH) break;
    }
  }
  return code;
}

/**
 * Compute the ISO 8601 expiry instant for a code issued at `now`:
 * exactly INVITE_TTL_MS (24 hours) later.
 */
export function computeExpiry(now: Date): string {
  return new Date(now.getTime() + INVITE_TTL_MS).toISOString();
}

/**
 * Whether a code with the given ISO 8601 `expiresAt` is expired at `now`.
 * A code is considered expired at and after its expiry instant.
 */
export function isExpired(expiresAt: string, now: Date): boolean {
  return now.getTime() >= new Date(expiresAt).getTime();
}

/** Normalize user-entered codes: trim surrounding whitespace and uppercase. */
export function normalizeCode(input: string): string {
  return input.trim().toUpperCase();
}
