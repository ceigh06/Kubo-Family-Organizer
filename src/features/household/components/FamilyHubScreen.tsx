import * as React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { House, ShieldCheck } from 'lucide-react';
import { db } from '../../../db';
import { getHousehold } from '../repository';
import { regenerateInviteCode } from '../householdService';
import { getCurrentMemberId } from '../currentMember';
import { MemberCard } from './MemberCard';
import { InviteCodeCard } from './InviteCodeCard';
import type { Member } from '../../../db/schema';

interface FamilyHubScreenProps {
  householdId: string;
  /** Navigate to a member's profile page. */
  onOpenMember: (member: Member) => void;
}

/**
 * Family Hub — the main household dashboard.
 *
 * Reads members and household live from Dexie via useLiveQuery.
 * No mock data; every value comes from the DB.
 */
export function FamilyHubScreen({ householdId, onOpenMember }: FamilyHubScreenProps) {
  const currentMemberId = getCurrentMemberId();

  const household = useLiveQuery(
    () => getHousehold(householdId),
    [householdId],
  );

  const members = useLiveQuery(
    () =>
      db.members
        .where('householdId')
        .equals(householdId)
        .filter((m) => !m.deleted)
        .toArray(),
    [householdId],
  );

  const currentMember = members?.find((m) => m.id === currentMemberId);
  const isAdmin = currentMember?.isAdmin ?? false;

  async function handleRegenerate() {
    if (!currentMember) return;
    try {
      await regenerateInviteCode(householdId, currentMember.id);
    } catch (err) {
      alert((err as Error).message);
    }
  }

  /* Loading state */
  if (household === undefined || members === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <span className="text-[18px] text-muted-foreground">Loading…</span>
      </div>
    );
  }

  /* Not found */
  if (household === null) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <span className="text-[18px] text-destructive">Household not found.</span>
      </div>
    );
  }

  const greeting = currentMember
    ? `Hello, ${currentMember.name} 👋`
    : 'Your family circle';

  return (
    <div className="flex flex-col gap-6 px-5 pt-6 pb-24">
      {/* Header */}
      <header className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary shrink-0">
          <House className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[22px] font-extrabold leading-tight truncate">
            {household.name}
          </h1>
          <p className="text-[15px] text-muted-foreground truncate">{greeting}</p>
        </div>
        {isAdmin && (
          <span
            className="ml-auto flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[12px] font-bold text-primary shrink-0"
            title="You are an admin"
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Admin
          </span>
        )}
      </header>

      {/* Member strip */}
      <section aria-labelledby="members-heading">
        <h2
          id="members-heading"
          className="text-[18px] font-extrabold mb-4"
        >
          {members.length} {members.length === 1 ? 'member' : 'members'}
        </h2>

        {members.length === 0 ? (
          <p className="text-[18px] text-muted-foreground">
            No members yet. Invite someone to join.
          </p>
        ) : (
          <div
            className="flex flex-wrap gap-4"
            role="list"
            aria-label="Family members"
          >
            {members.map((member) => (
              <div key={member.id} role="listitem">
                <MemberCard member={member} onPress={onOpenMember} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Invite code card */}
      <section aria-labelledby="invite-heading">
        <h2 id="invite-heading" className="sr-only">
          Invite code
        </h2>
        <InviteCodeCard
          household={household}
          isAdmin={isAdmin}
          onRegenerate={handleRegenerate}
        />
      </section>
    </div>
  );
}
