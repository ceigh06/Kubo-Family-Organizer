/**
 * Profile setup screen (photo, name, birthday, contact, role chips, color).
 *
 * Pure UI — calls `onSave` which is expected to call updateMember/saveMember
 * via the household service. Validation is local.
 */
import * as React from 'react';
import { Camera, Save } from 'lucide-react';
import type { MemberProfile } from '../householdService';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Label } from './ui/Label';

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'Mother',      label: 'Mother' },
  { value: 'Father',      label: 'Father' },
  { value: 'Daughter',    label: 'Daughter' },
  { value: 'Son',         label: 'Son' },
  { value: 'Brother',     label: 'Brother' },
  { value: 'Sister',      label: 'Sister' },
  { value: 'Grandmother', label: 'Grandmother' },
  { value: 'Grandfather', label: 'Grandfather' },
];

const COLOR_OPTIONS: { value: string; label: string }[] = [
  { value: 'bg-peach',     label: 'Peach' },
  { value: 'bg-lilac',     label: 'Lilac' },
  { value: 'bg-sky',       label: 'Sky' },
  { value: 'bg-secondary', label: 'Sage' },
  { value: 'bg-mint',      label: 'Mint' },
];

interface ProfileSetupScreenProps {
  /** Pre-fill for editing; when absent the form starts blank. */
  initial?: Partial<MemberProfile>;
  /** Called with the validated profile when the user saves. */
  onSave: (profile: MemberProfile) => void | Promise<void>;
  submitLabel?: string;
  /** Show a loading spinner on the submit button. */
  saving?: boolean;
}

export function ProfileSetupScreen({
  initial: init,
  onSave,
  submitLabel = 'Save',
  saving = false,
}: ProfileSetupScreenProps) {
  const [name,      setName]      = React.useState(init?.name ?? '');
  const [birthday,  setBirthday]  = React.useState(init?.birthday ?? '');
  const [contact,   setContact]   = React.useState(init?.contact ?? '');
  const [roleLabel, setRole]      = React.useState(init?.roleLabel ?? '');
  const [color,     setColor]     = React.useState(init?.color ?? COLOR_OPTIONS[0].value);
  const [photo,     setPhoto]     = React.useState<string | undefined>(init?.photo);
  const [error,     setError]     = React.useState<string | null>(null);

  const nameError = !name.trim() ? 'Please enter your name.' : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (nameError) { setError(nameError); return; }
    if (!roleLabel) { setError('Please choose a role.'); return; }
    const profile: MemberProfile = {
      name: name.trim(),
      birthday: birthday || undefined,  // YYYY-MM-DD or undefined
      contact: contact || undefined,
      roleLabel,
      color,
      photo,
    };
    await onSave(profile);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6 px-5 pt-6 pb-24">
      <header>
        <h1 className="text-[24px] font-extrabold leading-tight">
          {init?.name ? 'Update your profile' : 'A bit about you'}
        </h1>
        <p className="text-[15px] text-muted-foreground mt-1">
          This helps your family recognise you. You can change it later.
        </p>
      </header>

      {/* Photo */}
      <div className="flex flex-col gap-1.5">
        <Label>Photo</Label>
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground overflow-hidden">
            {photo ? (
              <img src={photo} alt="Profile preview" className="h-full w-full object-cover" />
            ) : (
              <Camera className="h-5 w-5" aria-hidden="true" />
            )}
          </span>
          <label className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-4 text-[15px] font-semibold cursor-pointer hover:bg-secondary">
            Choose photo
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setPhoto(reader.result as string);
                reader.readAsDataURL(file);
              }}
            />
          </label>
          {photo && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setPhoto(undefined)}>
              Remove
            </Button>
          )}
        </div>
      </div>

      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ps-name">Your name *</Label>
        <Input
          id="ps-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          autoFocus
          required
          aria-invalid={Boolean(error && !name.trim())}
        />
      </div>

      {/* Birthday */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ps-birthday">Birthday</Label>
        <Input
          id="ps-birthday"
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          max="9999-12-31"
        />
        <span className="text-[13px] text-muted-foreground">YYYY-MM-DD</span>
      </div>

      {/* Contact */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ps-contact">Contact</Label>
        <Input
          id="ps-contact"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Phone number or email"
          inputMode="text"
          autoComplete="tel"
        />
      </div>

      {/* Role chips */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-[15px] font-semibold text-foreground">Role label *</legend>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Role labels — choose one">
          {ROLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={roleLabel === opt.value}
              onClick={() => setRole(opt.value)}
              className={[
                'h-11 rounded-full px-4 text-[15px] font-semibold border-2 transition-colors',
                roleLabel === opt.value
                  ? 'bg-primary border-primary text-white'
                  : 'bg-background border-border text-foreground hover:bg-secondary',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Color */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-[15px] font-semibold text-foreground">Avatar color</legend>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Avatar color — choose one">
          {COLOR_OPTIONS.map((opt) => {
            const selected = color === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${opt.label}${selected ? ' — selected' : ''}`}
                onClick={() => setColor(opt.value)}
                className={[
                  'h-11 w-11 rounded-full border-4 transition-transform',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected ? 'border-foreground scale-110' : 'border-transparent',
                  opt.value,
                ].join(' ')}
              />
            );
          })}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-[15px] text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" variant="primary" className="mt-2 w-full" disabled={saving}>
        <Save className="h-5 w-5" aria-hidden="true" />
        {saving ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
