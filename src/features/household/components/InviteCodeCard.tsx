import * as React from 'react';
import { Copy, Check, RefreshCw, Clock } from 'lucide-react';
import type { Household } from '../../../db/schema';
import { cn } from './ui/cn';
import { Button } from './ui/Button';
import { isExpired } from '../inviteCode';

interface InviteCodeCardProps {
  household: Household;
  isAdmin: boolean;
  onRegenerate?: () => void;
}

function formatExpiry(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h >= 1) return `Expires in ${h}h ${m}m`;
  if (m >= 1) return `Expires in ${m}m`;
  return 'Expires in less than a minute';
}

/**
 * Displays the household invite code with a copy button and expiry countdown.
 * Admin members also see a regenerate button.
 * Minimum 56 px tap targets; code text is large for easy reading.
 */
export function InviteCodeCard({ household, isAdmin, onRegenerate }: InviteCodeCardProps) {
  const [copied, setCopied] = React.useState(false);
  const expired = isExpired(household.inviteExpiresAt, new Date());

  function handleCopy() {
    navigator.clipboard.writeText(household.inviteCode).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[18px] font-extrabold text-foreground">Family invite code</h2>
        {isAdmin && onRegenerate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRegenerate}
            aria-label="Regenerate invite code"
            title="Regenerate invite code"
            className="h-11 w-11 p-0 rounded-xl"
          >
            <RefreshCw className="h-5 w-5" aria-hidden="true" />
          </Button>
        )}
      </div>

      {/* The code itself */}
      <div
        className={cn(
          'rounded-xl text-center py-5 select-all',
          expired ? 'bg-muted' : 'bg-secondary',
        )}
      >
        <span
          className={cn(
            'font-mono text-[36px] font-extrabold tracking-[0.2em]',
            expired ? 'text-muted-foreground line-through' : 'text-primary',
          )}
          aria-label={`Invite code: ${household.inviteCode.split('').join(' ')}`}
        >
          {household.inviteCode}
        </span>
      </div>

      {/* Expiry + copy */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[14px] text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{formatExpiry(household.inviteExpiresAt)}</span>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopy}
          disabled={expired}
          aria-label={copied ? 'Code copied' : 'Copy invite code'}
          className="h-11 gap-2"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" aria-hidden="true" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy
            </>
          )}
        </Button>
      </div>

      <p className="text-[13px] text-muted-foreground">
        Share this code so others can join your household. Anyone with the code can join until it
        expires.
      </p>
    </div>
  );
}
