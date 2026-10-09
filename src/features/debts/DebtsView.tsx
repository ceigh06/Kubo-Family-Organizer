import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Check, Wallet, Users } from 'lucide-react';
import { db } from '@/db';
import type { Debt, Member } from '@/db/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type DebtDirection = 'owe' | 'owed';

interface AddDebtForm {
  reason: string;
  amount: string;
  memberId: string;
  direction: DebtDirection;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatAmount(amount: number): string {
  return `₱${amount.toLocaleString('en-PH')}`;
}

// ---------------------------------------------------------------------------
// PageHeading
// ---------------------------------------------------------------------------
function PageHeading({
  title,
  subtitle,
  onAdd,
}: {
  title: string;
  subtitle: string;
  onAdd?: () => void;
}) {
  return (
    <div className="page-heading">
      <div className="min-w-0">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {onAdd && (
        <button
          className="inline-flex items-center justify-center h-11 w-11 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
          aria-label={`Add to ${title}`}
          onClick={onAdd}
        >
          <Plus className="size-5" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MemberInitial — generates a coloured avatar from the member color field
// ---------------------------------------------------------------------------
function MemberInitial({ member }: { member: Member }) {
  return (
    <span
      className="member-avatar"
      style={{ background: member.color }}
      aria-hidden="true"
    >
      {member.name.charAt(0).toUpperCase()}
    </span>
  );
}

// ---------------------------------------------------------------------------
// DebtRow
// ---------------------------------------------------------------------------
function DebtRow({
  debt,
  member,
  onSettle,
}: {
  debt: Debt;
  member: Member | undefined;
  onSettle: (id: string, settled: boolean) => void;
}) {
  const name = member?.name ?? '—';
  const label = debt.settled
    ? 'All settled'
    : debt.fromId === 'me'
    ? `You owe ${name}`
    : `${name} owes you`;

  return (
    <div className="list-row">
      {member ? (
        <MemberInitial member={member} />
      ) : (
        <span className="member-avatar" style={{ background: 'var(--muted)' }}>
          <Users className="size-4" />
        </span>
      )}
      <div>
        <h3>{label}</h3>
        <p>{debt.reason}</p>
        <p className="font-semibold">{formatAmount(debt.amount)}</p>
      </div>
      <button
        className={
          debt.settled
            ? 'inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium bg-secondary text-primary hover:bg-secondary/80 transition-colors cursor-pointer'
            : 'inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer'
        }
        onClick={() => onSettle(debt.id, !debt.settled)}
        aria-label={debt.settled ? `Unsettle debt with ${name}` : `Settle debt with ${name}`}
      >
        {debt.settled ? <Check className="size-4" /> : 'Settle'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddDebtDialog
// ---------------------------------------------------------------------------
function AddDebtDialog({
  open,
  members,
  onClose,
  onSave,
}: {
  open: boolean;
  members: Member[];
  onClose: () => void;
  onSave: (form: AddDebtForm) => void;
}) {
  const [form, setForm] = useState<AddDebtForm>({
    reason: '',
    amount: '',
    memberId: members[0]?.id ?? '',
    direction: 'owe',
  });

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.reason.trim() || !form.amount || !form.memberId) return;
    onSave(form);
    setForm({ reason: '', amount: '', memberId: members[0]?.id ?? '', direction: 'owe' });
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-overlay"
        aria-hidden="true"
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-debt-title"
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 rounded-t-2xl bg-card p-6 pb-[max(24px,env(safe-area-inset-bottom))] shadow-lg"
      >
        <h2
          id="add-debt-title"
          className="font-display text-xl font-extrabold mb-5"
        >
          Add a family balance
        </h2>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          {/* Reason */}
          <label className="form-field">
            What was it for?
            <input
              required
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="e.g. Pizza night"
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            />
          </label>

          {/* Amount */}
          <label className="form-field">
            Amount (₱)
            <input
              required
              type="number"
              min={1}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="200"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </label>

          {/* Direction */}
          <label className="form-field">
            Direction
            <select
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
              value={form.direction}
              onChange={(e) =>
                setForm((f) => ({ ...f, direction: e.target.value as DebtDirection }))
              }
            >
              <option value="owe">You owe them</option>
              <option value="owed">They owe you</option>
            </select>
          </label>

          {/* Family member */}
          <label className="form-field">
            Family member
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No members found. Add members first.
              </p>
            ) : (
              <select
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.memberId}
                onChange={(e) => setForm((f) => ({ ...f, memberId: e.target.value }))}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.roleLabel}
                  </option>
                ))}
              </select>
            )}
          </label>

          <p className="prototype-note">
            Balances are a record between family members. No money is transferred.
          </p>

          <button
            type="submit"
            disabled={members.length === 0}
            className="h-11 w-full rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add to family
          </button>
        </form>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// DebtsView — main exported component
// ---------------------------------------------------------------------------
export function DebtsView() {
  const [addOpen, setAddOpen] = useState(false);

  const debts = useLiveQuery(() => db.debts.toArray(), []) ?? [];
  const members = useLiveQuery(() => db.members.toArray(), []) ?? [];

  // Map memberId → member for quick lookups
  const memberMap = new Map(members.map((m) => [m.id, m]));

  // Net balance: positive = owed to you, negative = you owe
  const netBalance = debts
    .filter((d) => !d.deleted && !d.settled)
    .reduce((sum, d) => {
      if (d.toId === 'me') return sum + d.amount;   // they owe you
      if (d.fromId === 'me') return sum - d.amount; // you owe them
      return sum;
    }, 0);

  const activeDebts = debts.filter((d) => !d.deleted);

  async function handleSettle(id: string, settled: boolean) {
    await db.debts.update(id, {
      settled,
      updatedAt: new Date().toISOString(),
    });
  }

  async function handleAdd(form: AddDebtForm) {
    const now = new Date().toISOString();
    const debt: Debt = {
      id: generateId(),
      householdId: 'local', // placeholder until household sync is implemented
      fromId: form.direction === 'owe' ? 'me' : form.memberId,
      toId: form.direction === 'owe' ? form.memberId : 'me',
      amount: Number(form.amount),
      reason: form.reason.trim(),
      settled: false,
      updatedAt: now,
      updatedBy: 'me',
      deleted: false,
    };
    await db.debts.add(debt);
  }

  return (
    <>
      <PageHeading
        title="Family balances"
        subtitle="A little give & take, all kept clear."
        onAdd={() => setAddOpen(true)}
      />

      {/* Balance summary band */}
      <div className="balance-band">
        <span className="text-sm">Your balance</span>
        <strong>
          {netBalance === 0
            ? '₱0'
            : netBalance > 0
            ? `+${formatAmount(netBalance)}`
            : `−${formatAmount(Math.abs(netBalance))}`}
        </strong>
        <span className="text-xs text-muted-foreground">
          {activeDebts.every((d) => d.settled)
            ? 'All caught up.'
            : 'Between you and your family'}
        </span>
      </div>

      {/* Debt list */}
      <div className="section-title">
        <h2>With your family</h2>
      </div>

      {activeDebts.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground">
          <Wallet className="mx-auto mb-3 size-8" />
          <p className="text-sm">No balances yet.</p>
          <button
            className="mt-2 text-sm font-semibold text-primary underline-offset-4 hover:underline cursor-pointer"
            onClick={() => setAddOpen(true)}
          >
            Add a family balance
          </button>
        </div>
      ) : (
        activeDebts.map((d) => (
          <DebtRow
            key={d.id}
            debt={d}
            member={memberMap.get(d.fromId === 'me' ? d.toId : d.fromId)}
            onSettle={handleSettle}
          />
        ))
      )}

      <p className="prototype-note mt-6">
        Balances are a record between family members. No money is transferred.
      </p>

      <AddDebtDialog
        open={addOpen}
        members={members.filter((m) => !m.deleted)}
        onClose={() => setAddOpen(false)}
        onSave={handleAdd}
      />
    </>
  );
}
