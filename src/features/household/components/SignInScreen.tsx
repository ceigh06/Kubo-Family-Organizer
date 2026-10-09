import * as React from 'react';
import { House } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Label } from './ui/Label';

interface SignInScreenProps {
  /** Called with the entered email/identifier. Wire to Supabase here. */
  onSignIn: (email: string) => void | Promise<void>;
  loading?: boolean;
}

const EMAIL_RE = /\S+@\S+\.\S+/;

export function SignInScreen({ onSignIn, loading = false }: SignInScreenProps) {
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) { setError('Please enter your email.'); return; }
    if (!EMAIL_RE.test(trimmed)) { setError('Please enter a valid email address.'); return; }
    setError(null);
    try {
      await onSignIn(trimmed);
    } catch (err) {
      setError((err as Error).message ?? 'Something went wrong. Please try again.');
    }
  }

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Brand */}
      <header className="flex flex-col items-center gap-3 pt-14 pb-8 px-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white">
          <House className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="text-[28px] font-extrabold leading-tight">
          Welcome to Kubo
        </h1>
        <p className="text-[15px] text-muted-foreground max-w-[28rem]">
          Your family's local-first organiser. Sign in to create or join a household.
        </p>
      </header>

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-5 px-5 pb-24"
      >
        {/* ── TODO: wire to Supabase ── */}
        {/* ── This onSignIn is intentionally a stub; replace with your Supabase
              auth flow. Example:
              const { data, error } = await supabase.auth.signInWithOtp({ email });
              if (error) throw error;
        ── */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="si-email">Email</Label>
          <Input
            id="si-email"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
            required
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'si-email-error' : undefined}
          />
        </div>

        <div
          className="rounded-xl bg-secondary px-4 py-3 text-[13px] text-primary"
          role="note"
          aria-label="Auth not wired yet"
        >
          This screen is not wired to auth yet. The <code className="font-mono font-bold">onSignIn</code> callback is a placeholder — wire it to Supabase when ready.
        </div>

        {error && (
          <p id="si-email-error" role="alert" className="text-[15px] text-destructive">
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-2"
          disabled={loading}
          aria-label={loading ? 'Signing in' : 'Continue with email'}
        >
          {loading ? 'Signing in…' : 'Continue with email'}
        </Button>

        <p className="text-center text-[13px] text-muted-foreground">
          You'll receive a sign-in link at your email.
        </p>
      </form>
    </div>
  );
}
