import * as React from 'react';
import { House, Users, Copy, Check as CheckIcon } from 'lucide-react';
import type { MemberProfile } from '../householdService';
import { createHousehold, joinHousehold } from '../householdService';
import { setCurrentMemberId } from '../currentMember';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { ProfileSetupScreen } from './ProfileSetupScreen';

type Mode = 'choose' | 'create_household' | 'join_household' | 'profile_create' | 'profile_join';

interface CreateOrJoinScreenProps {
  /** Called with the newly created/joined household and member ids. */
  onDone: (householdId: string, memberId: string) => void;
  onNeedSignIn?: () => void;
}

/**
 * Create-or-join flow. Create writes to IndexedDB for real.
 * Join calls joinHousehold and surfaces concrete errors for wrong/expired codes.
 */
export function CreateOrJoinScreen({ onDone, onNeedSignIn }: CreateOrJoinScreenProps) {
  const [mode,  setMode]   = React.useState<Mode>('choose');
  const [name,  setName]   = React.useState('');
  const [code,  setCode]   = React.useState('');
  const [error, setError]  = React.useState('');
  const [loading, setLoading] = React.useState(false);

  // Profile being collected in the final step
  const [householdForProfile, setHouseholdForProfile] = React.useState<string | null>(null);
  const [joinProfileMode, setJoinProfileMode] = React.useState(false); // true = showing profile step after join init
  const [pendingHouseholdId, setPendingHouseholdId] = React.useState<string | null>(null);

  // After household is created, user lands on profile setup.
  const [createdFlow, setCreatedFlow] = React.useState<{ id: string; creating: boolean } | null>(null);

  function resetErrors() { setError(''); }

  /* ─── Create household (real write via service) ─── */
  async function handleCreateHousehold(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Please enter a household name.'); return; }
    resetErrors();
    setLoading(true);
    try {
      // Create the household; we need a member to own it, so first go to profile.
      // Store the name and wait for the profile step so that the creator profile
      // (name/role/color/etc.) lands on the first Member row.
      setCreatedFlow({ id: name.trim(), creating: true });
      setMode('profile_create');
    } finally {
      setLoading(false);
    }
  }

  async function handleProfileForCreate(profile: MemberProfile) {
    if (!createdFlow) return;
    const householdName = createdFlow.id;
    setLoading(true);
    resetErrors();
    try {
      const { household, member } = await createHousehold(householdName, profile);
      setCurrentMemberId(member.id);
      onDone(household.id, member.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  /* ─── Join household ─── */
  async function handleJoinInit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) { setError('Please enter an invite code.'); return; }
    resetErrors();
    // Don't write yet — first collect the joiner's profile.
    setJoinProfileMode(true);
    setPendingHouseholdId(null);
  }

  async function handleProfileForJoin(profile: MemberProfile) {
    const trimmed = code.trim();
    setLoading(true);
    resetErrors();
    try {
      const member = await joinHousehold(trimmed, profile);
      setCurrentMemberId(member.id);
      onDone(member.householdId, member.id);
    } catch (err) {
      const msg = (err as Error).message;
      // Surface clear, specific messages for the two expected failures.
      if (/unknown/i.test(msg)) {
        setError("We couldn't find a household with that code. Check the spelling and try again.");
      } else if (/expired/i.test(msg)) {
        setError('This invite code has expired. Ask your family to share a fresh code.');
      } else {
        setError(msg);
      }
      // Stay on the profile step so the user can fix the code and retry without re-entering their profile.
      // No-op: the error panel below will appear.
    } finally {
      setLoading(false);
    }
  }

  /* ─── UI pieces ─── */
  if (mode === 'profile_create' && createdFlow) {
    return (
      <div className="flex flex-col gap-0">
        <header className="px-5 pt-6 pb-2">
          <h1 className="text-[24px] font-extrabold">Set up your profile</h1>
          <p className="text-[15px] text-muted-foreground mt-1">
            You're creating <strong className="text-foreground">"{createdFlow.id}"</strong>.
          </p>
        </header>
        {error && <p role="alert" className="px-5 text-[15px] text-destructive">{error}</p>}
        <ProfileSetupScreen initial={{}} onSave={handleProfileForCreate} saving={loading} submitLabel="Create household" />
        <button
          type="button"
          onClick={() => { setCreatedFlow(null); setMode('choose'); setError(''); }}
          className="mx-5 mt-2 text-[15px] text-muted-foreground underline underline-offset-2 h-11"
        >
          Back
        </button>
      </div>
    );
  }

  if (mode === 'join_household' && joinProfileMode) {
    return (
      <div className="flex flex-col gap-0">
        <header className="px-5 pt-6 pb-2">
          <h1 className="text-[24px] font-extrabold">Set up your profile</h1>
          <p className="text-[15px] text-muted-foreground mt-1">
            You're joining with code <strong className="text-foreground">{code.trim().toUpperCase()}</strong>.
          </p>
        </header>
        {error && <p role="alert" className="px-5 text-[15px] text-destructive">{error}</p>}
        <ProfileSetupScreen initial={{}} onSave={handleProfileForJoin} saving={loading} submitLabel="Join household" />
        <button
          type="button"
          onClick={() => { setJoinProfileMode(false); setError(''); }}
          className="mx-5 mt-2 text-[15px] text-muted-foreground underline underline-offset-2 h-11"
        >
          Back
        </button>
      </div>
    );
  }

  if (mode === 'create_household') {
    return (
      <div className="flex flex-col gap-6 px-5 pt-6 pb-24">
        <header className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary">
            <House className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="text-[24px] font-extrabold leading-tight">Create a household</h1>
        </header>

        <form onSubmit={handleCreateHousehold} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ch-name">Household name *</Label>
            <Input
              id="ch-name"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder="e.g. The Santos family"
              autoFocus
              required
            />
          </div>

          {error && <p role="alert" className="text-[15px] text-destructive">{error}</p>}

          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? 'Saving…' : 'Continue'}
          </Button>

          <button
            type="button"
            onClick={() => { setMode('choose'); setError(''); setName(''); }}
            className="text-[15px] text-muted-foreground underline underline-offset-2 h-11"
          >
            Back
          </button>
        </form>
      </div>
    );
  }

  if (mode === 'join_household') {
    return (
      <div className="flex flex-col gap-6 px-5 pt-6 pb-24">
        <header className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-card border border-border text-primary">
            <Users className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="text-[24px] font-extrabold leading-tight">Join a household</h1>
        </header>

        <form onSubmit={handleJoinInit} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ch-code">Invite code *</Label>
            <Input
              id="ch-code"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }}
              placeholder="e.g. A2B7KZ"
              autoFocus
              required
              autoComplete="off"
              className="font-mono tracking-widest uppercase"
            />
          </div>

          {error && <p role="alert" className="text-[15px] text-destructive">{error}</p>}

          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            Continue
          </Button>

          <button
            type="button"
            onClick={() => { setMode('choose'); setError(''); setCode(''); }}
            className="text-[15px] text-muted-foreground underline underline-offset-2 h-11"
          >
            Back
          </button>
        </form>
      </div>
    );
  }

  /* choose */
  return (
    <div className="flex flex-col gap-6 px-5 pt-6 pb-24">
      <div className="py-6 text-center flex flex-col gap-2">
        <h1 className="text-[28px] font-extrabold leading-tight">Your family hub</h1>
        <p className="text-[15px] text-muted-foreground">
          Create a new household or join one with an invite code.
        </p>
      </div>

      <div className="grid gap-4">
        <button
          type="button"
          onClick={() => { setMode('create_household'); setError(''); }}
          className="flex items-center gap-4 rounded-2xl border-2 border-primary bg-card p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
            <House className="h-6 w-6" aria-hidden="true" />
          </span>
          <span className="flex flex-col">
            <span className="text-[18px] font-extrabold leading-tight">Create a household</span>
            <span className="text-[14px] text-muted-foreground">You'll be its first admin.</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setMode('join_household'); setError(''); }}
          className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
            <Users className="h-6 w-6" aria-hidden="true" />
          </span>
          <span className="flex flex-col">
            <span className="text-[18px] font-extrabold leading-tight">Join a household</span>
            <span className="text-[14px] text-muted-foreground">Enter the invite code.</span>
          </span>
        </button>
      </div>

      {onNeedSignIn && (
        <button
          type="button"
          onClick={onNeedSignIn}
          className="text-[15px] text-muted-foreground underline underline-offset-2 h-11 self-center"
        >
          Back to sign in
        </button>
      )}
    </div>
  );
}
