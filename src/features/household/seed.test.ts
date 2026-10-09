import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it } from 'vitest';

import { db } from '../../db';
import { listMembers } from './repository';
import { seedHousehold } from './seed';

beforeEach(async () => {
  await db.households.clear();
  await db.members.clear();
  await db.syncQueue.clear();
  // currentMember uses localStorage; reset between tests.
  if (typeof localStorage !== 'undefined') localStorage.clear();
});

describe('seedHousehold', () => {
  it('creates exactly 5 members', async () => {
    const result = await seedHousehold();
    expect(result.members).toHaveLength(5);
  });

  it('makes Mom the only admin', async () => {
    const result = await seedHousehold();
    const admins = result.members.filter((m) => m.isAdmin);
    expect(admins).toHaveLength(1);
    expect(admins[0].name).toBe('Mom');
  });

  it('includes all expected names', async () => {
    const { members } = await seedHousehold();
    const names = members.map((m) => m.name);
    expect(names).toContain('Mom');
    expect(names).toContain('Dad');
    expect(names).toContain('Kuya');
    expect(names).toContain('Lola');
    expect(names).toContain('Ate');
  });

  it('persists all members under the same householdId', async () => {
    const { householdId } = await seedHousehold();
    const persisted = await listMembers(householdId);
    expect(persisted).toHaveLength(5);
    expect(persisted.every((m) => m.householdId === householdId)).toBe(true);
  });

  it('each member has a distinct color', async () => {
    const { householdId } = await seedHousehold();
    const members = await listMembers(householdId);
    const colors = members.map((m) => m.color);
    expect(new Set(colors).size).toBe(5);
  });

  it('every member has a YYYY-MM-DD birthday', async () => {
    const { householdId } = await seedHousehold();
    const members = await listMembers(householdId);
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    for (const m of members) {
      expect(m.birthday).toMatch(iso);
    }
  });

  it('is idempotent: a second call returns the same householdId', async () => {
    const first = await seedHousehold();
    // Seed stores the id in localStorage; second call detects it.
    const second = await seedHousehold();
    expect(second.householdId).toBe(first.householdId);
    expect(await db.members.count()).toBe(5);
  });
});
