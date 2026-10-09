/**
 * Household data-access layer.
 *
 * Thin wrapper over Dexie. Components never import this directly; services do.
 * Rules honored here:
 * - soft delete only: callers never see rows with `deleted === true`
 * - every query filters `.filter(r => !r.deleted)`
 * - lookups by an indexed field use `.first()`
 * - every save refreshes `updatedAt`
 * - every write enqueues a syncQueue entry
 */
import { db } from '../../db';
import type { Household, Member, SyncQueueItem } from '../../db/schema';
import { normalizeCode } from './inviteCode';

type SyncOp = SyncQueueItem['op'];

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Enqueue a sync record for a write.
 *
 * NOTE: `SyncQueueItem` has no field identifying the affected row (e.g. `rowId`),
 * so a queued entry currently records only which table changed and how — not which
 * record. This needs a schema change (a `rowId`/`recordId` field) before it can drive
 * a real sync engine; not done yet.
 */
async function enqueueSync(table: string, op: SyncOp): Promise<void> {
  const entry: SyncQueueItem = {
    id: crypto.randomUUID(),
    table,
    op,
    createdAt: nowIso(),
  };
  await db.syncQueue.add(entry);
}

/** Look up an active household by its (normalized) invite code. */
export function getHouseholdByInviteCode(code: string): Promise<Household | undefined> {
  return db.households
    .where('inviteCode')
    .equals(normalizeCode(code))
    .filter((h) => !h.deleted)
    .first();
}

/** Look up an active household by primary key. */
export function getHousehold(id: string): Promise<Household | undefined> {
  return db.households
    .where('id')
    .equals(id)
    .filter((h) => !h.deleted)
    .first();
}

/** All active members of a household. */
export function listMembers(householdId: string): Promise<Member[]> {
  return db.members
    .where('householdId')
    .equals(householdId)
    .filter((m) => !m.deleted)
    .toArray();
}

/** Look up an active member linked to an auth user id. */
export function getMemberByUserId(userId: string): Promise<Member | undefined> {
  if (!userId) return Promise.resolve(undefined);
  return db.members
    .where('userId')
    .equals(userId)
    .filter((m) => !m.deleted)
    .first();
}

/** Create or update a household. Always refreshes `updatedAt`. */
export async function saveHousehold(household: Household): Promise<Household> {
  const existing = await db.households.get(household.id);
  const row: Household = { ...household, updatedAt: nowIso() };
  await db.households.put(row);
  await enqueueSync('households', existing ? 'update' : 'create');
  return row;
}

/** Create or update a member. Always refreshes `updatedAt`. */
export async function saveMember(member: Member): Promise<Member> {
  const existing = await db.members.get(member.id);
  const row: Member = { ...member, updatedAt: nowIso() };
  await db.members.put(row);
  await enqueueSync('members', existing ? 'update' : 'create');
  return row;
}

/** Soft-delete a member. Idempotent: a missing or already-deleted member is a no-op. */
export async function softDeleteMember(id: string, updatedBy: string): Promise<void> {
  const member = await db.members.get(id);
  if (!member || member.deleted) return;
  await db.members.put({ ...member, deleted: true, updatedAt: nowIso(), updatedBy });
  await enqueueSync('members', 'delete');
}
