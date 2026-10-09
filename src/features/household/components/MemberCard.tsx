import * as React from 'react';
import type { Member } from '../../../db/schema';
import { cn } from './ui/cn';
import { ShieldCheck } from 'lucide-react';

interface MemberCardProps {
  member: Member;
  /** Called when the card is pressed; used to open the member profile. */
  onPress?: (member: Member) => void;
}

/** Derives a single-letter initial from a member's name. */
function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

/**
 * Member avatar + name card used inside FamilyHubScreen.
 * Renders the member's color, initials, role label, and an Admin badge.
 * Tap target is 56 px minimum; text is 18 px+.
 */
export function MemberCard({ member, onPress }: MemberCardProps) {
  return (
    <button
      type="button"
      onClick={() => onPress?.(member)}
      className={cn(
        'flex flex-col items-center gap-2 min-w-[64px] bg-transparent border-none cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl p-1',
      )}
      aria-label={`${member.name}, ${member.roleLabel}${member.isAdmin ? ', admin' : ''}`}
    >
      {/* Avatar circle — colored by member.color token */}
      <span
        className={cn(
          'relative flex h-14 w-14 items-center justify-center rounded-full',
          'text-[22px] font-extrabold select-none shrink-0',
          member.color,
        )}
        aria-hidden="true"
      >
        {member.photo ? (
          <img
            src={member.photo}
            alt=""
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          initial(member.name)
        )}

        {/* Online / admin status dot */}
        {member.isAdmin && (
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary border-2 border-background"
            title="Admin"
          >
            <ShieldCheck className="h-3 w-3 text-white" aria-hidden="true" />
          </span>
        )}
      </span>

      <span className="text-[13px] font-semibold text-foreground leading-tight text-center max-w-[68px] truncate">
        {member.name}
      </span>

      <span className="text-[11px] text-muted-foreground leading-tight text-center max-w-[68px] truncate">
        {member.roleLabel}
      </span>

      {member.isAdmin && (
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold bg-primary/10 text-primary leading-none">
          Admin
        </span>
      )}
    </button>
  );
}
