/**
 * Household service: orchestrates the repository for onboarding and membership.
 *
 * Plain TypeScript (no React). Components call this; it calls the repository.
 * Business rules:
 * - creating a household makes the creator its admin
 * - joining requires an existing, non-expired code
 * - only an admin may regenerate the invite code
 * - roles are labels only; `isAdmin` is the sole capability flag
 */
import type { Household, Member } from '../../db/schema';
import { computeExpiry, generateInviteCode, isExpired } from './inviteCode';
import {
  getHousehold,
  getHouseholdByInviteCode,
  getMemberById,
  saveHousehold,
  saveMember,
} from './repository';

/** Fields a member can set about themselves; `isAdmin`/ids are not writable here. */
export interface MemberProfile {
  name: string;
  roleLabel: string;
  color: string;
  photo?: string;
  contact?: string;
  /** Date only, `YYYY-MM-DD`. */
  birthday?: string;
}

export interface CreateHouseholdResult {
  household: Household;
  member: Member;
}

/** Create a household and its first member (the admin). */
export async function createHousehold(
  name: string,
  creatorProfile: MemberProfile,
  userId?: string,
): Promise<CreateHouseholdResult> {
  const now = new Date();
  const householdId = crypto.randomUUID();
  const memberId = crypto.randomUUID();

  const household: Household = {
    id: householdId,
    name,
    inviteCode: generateInviteCode(),
    inviteExpiresAt: computeExpiry(now),
    updatedAt: now.toISOString(),
    updatedBy: memberId,
    deleted: false,
  };

  const member: Member = {
    id: memberId,
    householdId,
    ...creatorProfile,
    isAdmin: true,
    userId,
    updatedAt: now.toISOString(),
    updatedBy: memberId,
    deleted: false,
  };

  const savedHousehold = await saveHousehold(household);
  const savedMember = await saveMember(member);
  return { household: savedHousehold, member: savedMember };
}

/** Join an existing household by invite code. Throws if the code is unknown or expired. */
export async function joinHousehold(
  code: string,
  profile: MemberProfile,
  userId?: string,
): Promise<Member> {
  const household = await getHouseholdByInviteCode(code);
  if (!household) throw new Error('Unknown invite code');
  if (isExpired(household.inviteExpiresAt, new Date())) {
    throw new Error('Invite code has expired');
  }

  const memberId = crypto.randomUUID();
  const now = new Date();
  const member: Member = {
    id: memberId,
    householdId: household.id,
    ...profile,
    isAdmin: false,
    userId,
    updatedAt: now.toISOString(),
    updatedBy: memberId,
    deleted: false,
  };
  return saveMember(member);
}

/** Regenerate a household's invite code. Admin-only; invalidates the previous code. */
export async function regenerateInviteCode(
  householdId: string,
  byMemberId: string,
): Promise<Household> {
  const household = await getHousehold(householdId);
  if (!household) throw new Error('Household not found');

  const actor = await getMemberById(byMemberId);
  if (!actor) throw new Error('Member not found');
  if (actor.householdId !== householdId) {
    throw new Error('Member does not belong to this household');
  }
  if (!actor.isAdmin) throw new Error('Only an admin can regenerate the invite code');

  const now = new Date();
  return saveHousehold({
    ...household,
    inviteCode: generateInviteCode(),
    inviteExpiresAt: computeExpiry(now),
    updatedBy: byMemberId,
  });
}

/** Update a member's editable profile fields. Ids, household, and admin flag are not writable. */
export async function updateMember(
  memberId: string,
  changes: Partial<MemberProfile>,
  updatedBy: string,
): Promise<Member> {
  const member = await getMemberById(memberId);
  if (!member) throw new Error('Member not found');

  const patch: Partial<MemberProfile> = {};
  if (changes.name !== undefined) patch.name = changes.name;
  if (changes.roleLabel !== undefined) patch.roleLabel = changes.roleLabel;
  if (changes.color !== undefined) patch.color = changes.color;
  if (changes.photo !== undefined) patch.photo = changes.photo;
  if (changes.contact !== undefined) patch.contact = changes.contact;
  if (changes.birthday !== undefined) patch.birthday = changes.birthday;

  return saveMember({ ...member, ...patch, updatedBy });
}
