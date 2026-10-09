/**
 * Authentication boundary for Kubo.
 *
 * All auth logic lives here. The rest of the app imports only:
 *   signIn(email)        — sign in (or create) a local session
 *   signOut()            — clear the local session
 *   getCurrentUserId()   — read the stored userId
 *   setCurrentUserId()   — write the stored userId (used by real auth callback)
 *
 * STUB IMPLEMENTATION
 * -------------------
 * Real Supabase auth is not wired yet. The stub deterministically derives a
 * userId from the email so the same email always lands on the same userId on
 * the same device. It requires no network and no backend.
 *
 * TO REPLACE WITH REAL AUTH
 * -------------------------
 * 1. Implement `signIn` to call your Supabase/auth provider.
 * 2. After a successful auth response, call `setCurrentUserId(user.id)`.
 * 3. Leave every other export unchanged — the rest of the app is unaffected.
 *
 * Example (Supabase magic-link):
 *   import { supabase } from '../supabaseClient';
 *   export async function signIn(email: string): Promise<void> {
 *     const { error } = await supabase.auth.signInWithOtp({ email });
 *     if (error) throw error;
 *     // userId is set later when the session resolves via onAuthStateChange
 *   }
 *
 * Plain TypeScript: no React, no Dexie.
 */

const USER_ID_KEY = 'kubo_userId';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Derive a stable, deterministic userId from an email for local dev/testing.
 * Not cryptographically secure — only used by the stub.
 */
function deriveLocalUserId(email: string): string {
  // Simple djb2-style hash → hex string, prefixed so it's clearly a stub id.
  let h = 5381;
  for (let i = 0; i < email.length; i++) {
    h = ((h << 5) + h) ^ email.charCodeAt(i);
    h = h >>> 0; // keep unsigned 32-bit
  }
  return `local_${h.toString(16).padStart(8, '0')}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Read the current device userId, if any. */
export function getCurrentUserId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return localStorage.getItem(USER_ID_KEY) ?? undefined;
}

/** Write a userId for this device (called by real auth after a successful login). */
export function setCurrentUserId(userId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_ID_KEY, userId);
}

/** Remove the stored userId (sign out). */
export function clearCurrentUserId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_ID_KEY);
}

/**
 * Sign in with an email address.
 *
 * STUB: derives a deterministic local userId from the email and stores it.
 * Replace the body of this function with a real auth call when ready.
 * The signature must remain `(email: string) => Promise<void>`.
 */
export async function signIn(email: string): Promise<void> {
  const userId = deriveLocalUserId(email.trim().toLowerCase());
  setCurrentUserId(userId);
}

/** Sign out: clears the stored userId. */
export async function signOut(): Promise<void> {
  clearCurrentUserId();
}
