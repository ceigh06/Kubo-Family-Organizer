import * as React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CalendarDays,
  Phone,
  ShieldCheck,
  Pencil,
  Check,
  X,
  UserCircle2,
} from 'lucide-react';
import { getMemberById } from '../repository';
import { updateMember, type MemberProfile } from '../householdService';
import { getCurrentMemberId } from '../currentMember';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { cn } from './ui/cn';

interface MemberProfileScreenProps {
  memberId: string;
  onBack?: () => void;
}

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase();
}

function formatBirthday(iso?: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * View and edit a single member's profile.
 * The current device user can always edit their own profile.
 * An admin can also edit any member in the same household.
 */
export function MemberProfileScreen({ memberId, onBack }: MemberProfileScreenProps) {
  const currentMemberId = getCurrentMemberId();
  const member = useLiveQuery(() => getMemberById(memberId), [memberId]);

  const currentMember = useLiveQuery(
    () => (currentMemberId ? getMemberById(currentMemberId) : undefined),
    [currentMemberId],
  );

  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  // Controlled edit state
  const [draft, setDraft] = React.useState<Partial<MemberProfile>>({});

  React.useEffect(() => {
    if (member) {
      setDraft({
        name: member.name,
        roleLabel: member.roleLabel,
        color: member.color,
        birthday: member.birthday ?? '',
        contact: member.contact ?? '',
        photo: member.photo ?? '',
      });
    }
  }, [member]);

  if (member === undefined || currentMember === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <span className="text-[18px] text-muted-foreground">Loading…</span>
      </div>
    );
  }
  if (!member) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <span className="text-[18px] text-destructive">Member not found.</span>
      </div>
    );
  }

  const canEdit =
    member.id === currentMemberId ||
    (currentMember?.isAdmin && currentMember.householdId === member.householdId);

  async function handleSave() {
    if (!currentMemberId) return;
    if (!draft.name?.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateMember(member!.id, draft, currentMemberId);
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setEditing(false);
    setError('');
    setDraft({
      name: member!.name,
      roleLabel: member!.roleLabel,
      color: member!.color,
      birthday: member!.birthday ?? '',
      contact: member!.contact ?? '',
      photo: member!.photo ?? '',
    });
  }

  return (
    <div className="flex flex-col gap-0 pb-24">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Back"
            className="shrink-0"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
        <h1 className="text-[22px] font-extrabold flex-1 truncate">
          {editing ? 'Edit profile' : member.name}
        </h1>
        {canEdit && !editing && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setEditing(true)}
            aria-label="Edit profile"
            className="shrink-0"
          >
            <Pencil className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center gap-3 py-6 bg-secondary/40">
        <span
          className={cn(
            'flex h-20 w-20 items-center justify-center rounded-full text-[34px] font-extrabold select-none',
            editing ? (draft.color ?? member.color) : member.color,
          )}
          aria-hidden="true"
        >
          {member.photo ? (
            <img src={member.photo} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            initial(editing ? (draft.name ?? member.name) : member.name)
          )}
        </span>
        {member.isAdmin && (
          <span className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1 text-[13px] font-bold text-primary">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Admin
          </span>
        )}
      </div>

      <div className="px-5 pt-6 flex flex-col gap-5">
        {editing ? (
          /* ── Edit form ── */
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mp-name">Name</Label>
              <Input
                id="mp-name"
                value={draft.name ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Full name"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mp-role">Role label</Label>
              <Input
                id="mp-role"
                value={draft.roleLabel ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, roleLabel: e.target.value }))}
                placeholder="e.g. Mother, Son"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mp-birthday">Birthday</Label>
              <Input
                id="mp-birthday"
                type="date"
                value={draft.birthday ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, birthday: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mp-contact">Contact</Label>
              <Input
                id="mp-contact"
                value={draft.contact ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, contact: e.target.value }))}
                placeholder="Phone or email"
              />
            </div>

            {error && (
              <p role="alert" className="text-[15px] text-destructive">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleSave}
                disabled={saving}
              >
                <Check className="h-5 w-5" aria-hidden="true" />
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button variant="outline" className="flex-1" onClick={handleCancel} disabled={saving}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          /* ── View mode ── */
          <>
            <InfoRow icon={<UserCircle2 />} label="Role" value={member.roleLabel} />
            <InfoRow
              icon={<CalendarDays />}
              label="Birthday"
              value={formatBirthday(member.birthday)}
            />
            {member.contact && (
              <InfoRow icon={<Phone />} label="Contact" value={member.contact} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-border last:border-0">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] text-muted-foreground">{label}</p>
        <p className="text-[18px] font-semibold text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}
