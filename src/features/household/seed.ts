/**
 * Seed data for local development and testing.
 *
 * Creates one household (The Santos family) with 5 members.
 * Mom is the admin (creator); Dad, Kuya, Lola, and Ate join with the
 * invite code.
 *
 * Also marks Mom as the current member on this device via currentMember.ts
 * so the app has a usable local identity out of the box.
 *
 * Usage: call seedHousehold() once from an app init or dev bootstrap.
 * Idempotent: if any non-deleted household already exists in the local DB
 * it returns that household without adding anything.
 *
 * Plain TypeScript: no React.
 */
import { db } from '../../db';
import { setCurrentMemberId } from './currentMember';
import { createHousehold, joinHousehold } from './householdService';

export interface SeedResult {
  householdId: string;
  members: { name: string; id: string; isAdmin: boolean }[];
  inviteCode: string;
}

export async function seedHousehold(): Promise<SeedResult> {
  // Idempotency guard: use the DB itself so it works in Node (no localStorage).
  const existing = await db.households.filter((h) => !h.deleted).first();
  if (existing) {
    const members = await db.members
      .where('householdId')
      .equals(existing.id)
      .filter((m) => !m.deleted)
      .toArray();
    // Re-set current member in case localStorage was cleared.
    const admin = members.find((m) => m.isAdmin);
    if (admin) setCurrentMemberId(admin.id);
    return {
      householdId: existing.id,
      members: members.map((m) => ({ name: m.name, id: m.id, isAdmin: m.isAdmin })),
      inviteCode: existing.inviteCode,
    };
  }

  // Step 1: Mom creates the household and becomes admin.
  const { household, member: mom } = await createHousehold(
    'The Santos family',
    {
      name: 'Mom',
      roleLabel: 'Mother',
      color: 'bg-lilac',
      birthday: '1972-05-24',
    },
    /* userId */ undefined,
  );

  // Step 2: Remaining four members join with the invite code.
  const profiles: Parameters<typeof joinHousehold>[1][] = [
    { name: 'Dad',  roleLabel: 'Father',     color: 'bg-sky',       birthday: '1970-09-08' },
    { name: 'Kuya', roleLabel: 'Brother',    color: 'bg-secondary', birthday: '2001-01-19' },
    { name: 'Lola', roleLabel: 'Grandmother',color: 'bg-peach',     birthday: '1948-11-02' },
    { name: 'Ate',  roleLabel: 'Sister',     color: 'bg-mint',      birthday: '1998-03-12' },
  ];

  const joinedMembers = await Promise.all(
    profiles.map((p) => joinHousehold(household.inviteCode, p)),
  );

  // Step 3: Mark Mom as the current member on this device.
  setCurrentMemberId(mom.id);

  const allMembers = [mom, ...joinedMembers];
  return {
    householdId: household.id,
    members: allMembers.map((m) => ({ name: m.name, id: m.id, isAdmin: m.isAdmin })),
    inviteCode: household.inviteCode,
  };
}
