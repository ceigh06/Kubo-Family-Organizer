import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '../../db';
import {
  createHousehold,
  joinHousehold,
  regenerateInviteCode,
  updateMember,
  type MemberProfile,
} from './householdService';
import { getHousehold, listMembers, saveHousehold } from './repository';

const creator: MemberProfile = { name: 'Mia', roleLabel: 'Daughter', color: 'bg-peach' };
const joiner: MemberProfile = { name: 'Dad', roleLabel: 'Father', color: 'bg-sky' };

beforeEach(async () => {
  await db.households.clear();
  await db.members.clear();
  await db.syncQueue.clear();
});

describe('createHousehold', () => {
  it('makes the creator an admin with a valid code and ~24h expiry', async () => {
    const before = Date.now();
    const { household, member } = await createHousehold('The Santos family', creator, 'user-1');

    expect(member.isAdmin).toBe(true);
    expect(member.householdId).toBe(household.id);
    expect(member.userId).toBe('user-1');
    expect(household.inviteCode).toHaveLength(6);
    expect(household.inviteCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);

    const expiry = new Date(household.inviteExpiresAt).getTime();
    const day = 24 * 60 * 60 * 1000;
    expect(expiry).toBeGreaterThanOrEqual(before + day);
    expect(expiry).toBeLessThanOrEqual(Date.now() + day);
  });

  it('persists the household, the admin member, and sync entries', async () => {
    const { household, member } = await createHousehold('Home', creator);

    expect((await getHousehold(household.id))?.id).toBe(household.id);
    const members = await listMembers(household.id);
    expect(members.map((m) => m.id)).toContain(member.id);

    const queue = await db.syncQueue.toArray();
    expect(queue.some((q) => q.table === 'households' && q.op === 'create')).toBe(true);
    expect(queue.some((q) => q.table === 'members' && q.op === 'create')).toBe(true);
  });
});

describe('joinHousehold', () => {
  it('adds a non-admin member for a valid code', async () => {
    const { household } = await createHousehold('Home', creator);
    const joined = await joinHousehold(household.inviteCode, joiner, 'user-2');

    expect(joined.isAdmin).toBe(false);
    expect(joined.householdId).toBe(household.id);
    expect(joined.userId).toBe('user-2');

    const members = await listMembers(household.id);
    expect(members).toHaveLength(2);
  });

  it('accepts a lowercased, whitespace-padded code', async () => {
    const { household } = await createHousehold('Home', creator);
    const joined = await joinHousehold(`  ${household.inviteCode.toLowerCase()}  `, joiner);
    expect(joined.householdId).toBe(household.id);
  });

  it('rejects an unknown code without adding a member', async () => {
    await expect(joinHousehold('ZZZZZZ', joiner)).rejects.toThrow(/unknown/i);
    expect(await db.members.count()).toBe(0);
  });

  it('rejects an expired code without adding a member', async () => {
    const { household } = await createHousehold('Home', creator);
    await saveHousehold({
      ...household,
      inviteExpiresAt: new Date(Date.now() - 1000).toISOString(),
    });

    await expect(joinHousehold(household.inviteCode, joiner)).rejects.toThrow(/expired/i);
    expect(await listMembers(household.id)).toHaveLength(1);
  });
});

describe('regenerateInviteCode', () => {
  it('lets an admin regenerate and invalidates the old code', async () => {
    const { household, member } = await createHousehold('Home', creator);
    const oldCode = household.inviteCode;

    const updated = await regenerateInviteCode(household.id, member.id);

    expect(updated.inviteCode).toHaveLength(6);
    expect(updated.inviteCode).not.toBe(oldCode);
    expect(updated.inviteExpiresAt).not.toBe(household.inviteExpiresAt);

    // Old code is dead; new code works.
    await expect(joinHousehold(oldCode, joiner)).rejects.toThrow(/unknown/i);
    const joined = await joinHousehold(updated.inviteCode, joiner);
    expect(joined.householdId).toBe(household.id);

    // Change is persisted.
    expect((await getHousehold(household.id))?.inviteCode).toBe(updated.inviteCode);
  });

  it('refuses regeneration by a non-admin', async () => {
    const { household } = await createHousehold('Home', creator);
    const joined = await joinHousehold(household.inviteCode, joiner);

    await expect(regenerateInviteCode(household.id, joined.id)).rejects.toThrow(/admin/i);
    expect((await getHousehold(household.id))?.inviteCode).toBe(household.inviteCode);
  });
});

describe('updateMember', () => {
  it('updates editable profile fields and leaves the admin flag untouched', async () => {
    const { member } = await createHousehold('Home', creator);

    const updated = await updateMember(
      member.id,
      { roleLabel: 'Mother', color: 'bg-lilac', birthday: '1990-05-24' },
      member.id,
    );

    expect(updated.roleLabel).toBe('Mother');
    expect(updated.color).toBe('bg-lilac');
    expect(updated.birthday).toBe('1990-05-24');
    expect(updated.isAdmin).toBe(true);
    expect(updated.id).toBe(member.id);
  });

  it('ignores attempts to change the admin flag', async () => {
    const { member } = await createHousehold('Home', creator);
    const hostile = { isAdmin: false } as unknown as Partial<MemberProfile>;

    const updated = await updateMember(member.id, hostile, member.id);
    expect(updated.isAdmin).toBe(true);
  });

  it('rejects an unknown member', async () => {
    await expect(updateMember('missing', { name: 'X' }, 'someone')).rejects.toThrow(/not found/i);
  });
});
