/**
 * Device-local current member identity.
 *
 * Stores the id of the member currently signed in on this device.
 * Uses localStorage (not Dexie) because this is a device/browser-local
 * session concept, not household data.
 *
 * Plain TypeScript: no React, no Dexie.
 */
const STORAGE_KEY = 'kubo_currentMemberId';

/**
 * Get the current member id, if any.
 */
export function getCurrentMemberId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return localStorage.getItem(STORAGE_KEY) ?? undefined;
}

/**
 * Set the current member id on this device.
 */
export function setCurrentMemberId(memberId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, memberId);
}

/**
 * Clear the current member (sign out on this device).
 */
export function clearCurrentMemberId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}