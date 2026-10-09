import * as React from 'react';
import { House } from 'lucide-react';
import { signIn } from '../auth';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Label } from './ui/Label';

interface SignInScreenProps {
  /**
   * Called after a successful sign-in so the parent can route to
   * create-or-join. No auth details are passed; read getCurrentUserId()
   * from auth.ts if you need the userId.
   */
  onSuccess: () => void;
}

const EMAIL_RE = /\S+@\S+\.\S+/;

/**
 * Sign-in entry point.
 *
 * Calls `signIn(email)` from auth.ts — currently a local stub that
 * derives a deterministic userId from the email. When real Supabase auth
 * is wired, only auth.ts changes; this component is untouched.
 */
export function SignInScreen({ onSuccess }: SignInScreenProps) {
  const [email,   setEmail]   = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error,   setError]   = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Please enter your email.');
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signIn(trimmed);
      onSuccess();
    } catch (err) {
      setError((err as Error).message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Brand */}
      <header className="flex flex-col items-center gap-3 pt-14 pb-8 px-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white">
          <House className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="text-[28px] font-extrabold leading-tight">Welcome to Kubo</h1>
        <p className="text-[15px] text-muted-foreground max-w-[28rem]">
          Your family's local-first organiser. Enter your email to continue.
        </p>
      </header>

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 px-5 pb-24">
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

        {/* Stub notice — remove when real auth is wired */}
        <div
          className="rounded-xl bg-secondary px-4 py-3 text-[13px] text-primary"
          role="note"
        >
          <strong>Local stub:</strong> no email is sent. Any valid address creates a
          device-local session instantly. Replace <code className="font-mono">signIn()</code>
          {' '}in <code className="font-mono">auth.ts</code> to use real auth.
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
        >
          {loading ? 'Signing in…' : 'Continue'}
        </Button>
      </form>
    </div>
  );
}
