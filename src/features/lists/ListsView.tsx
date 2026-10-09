import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Plus,
  Check,
  ShoppingBasket,
  Receipt,
  House,
  Circle,
  CheckCircle2,
  Trash2,
  ArrowLeftRight,
  ChevronRight,
  Clock,
  Camera,
  Sparkles,
  Activity,
  Lightbulb,
} from 'lucide-react';
import { db } from '@/db';
import type { GroceryItem, Bill, Member } from '@/db/schema';
import { ScanGroceryModal } from './ScanGroceryModal';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatAmount(amount: number): string {
  return `₱${amount.toLocaleString('en-PH')}`;
}

export function getNextMonthDueDate(dateString: string): string {
  const parts = dateString.split('-');
  if (parts.length === 3) {
    let year = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10); // 1-12
    const day = parseInt(parts[2], 10);

    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }

    // Clamp to max days in target month (e.g. Feb 28/29, Apr 30)
    const maxDays = new Date(year, month, 0).getDate();
    const clampedDay = Math.min(day, maxDays);

    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${year}-${pad(month)}-${pad(clampedDay)}`;
  }

  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  const currentMonth = d.getMonth();
  const day = d.getDate();
  const targetMonth = (currentMonth + 1) % 12;
  const targetYear = currentMonth === 11 ? d.getFullYear() + 1 : d.getFullYear();
  const maxDays = new Date(targetYear, targetMonth + 1, 0).getDate();
  const clampedDay = Math.min(day, maxDays);
  return `${targetYear}-${(targetMonth + 1).toString().padStart(2, '0')}-${clampedDay.toString().padStart(2, '0')}`;
}

function formatDueDate(dateString: string): string {
  if (!dateString) return '—';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return dateString;
}

const GROCERY_CATEGORIES = [
  'Produce',
  'Dairy & eggs',
  'Pantry',
  'Meat & seafood',
  'Household',
  'Snacks & drinks',
  'Other',
];

type GrocerySummaryPeriod = 'day' | 'week';

function getGrocerySummaryRange(period: GrocerySummaryPeriod, now: Date): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week') {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  }
  const end = new Date(start);
  end.setDate(end.getDate() + (period === 'day' ? 1 : 7));
  return { start, end };
}

function GroceryActivitySection({
  title,
  items,
  period,
  emptyMessage,
  deleted = false,
  checked = false,
}: {
  title: string;
  items: GroceryItem[];
  period: GrocerySummaryPeriod;
  emptyMessage: string;
  deleted?: boolean;
  checked?: boolean;
}) {
  return (
    <section className="mt-5">
      <h3 className="mb-1 text-sm font-bold">{title} <span className="font-medium text-muted-foreground">({items.length})</span></h3>
      {items.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="divide-y divide-border">
          {items.map((item) => (
            <div className="flex items-center justify-between gap-3 py-3" key={item.id}>
              <div className="min-w-0">
                <p className={`truncate text-sm font-semibold ${deleted ? 'text-muted-foreground line-through' : ''}`}>
                  {item.name}
                </p>
                <p className="text-xs text-muted-foreground">{item.category || 'Pantry'}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-semibold">{deleted ? 'Deleted' : checked ? 'Checked out' : 'On list'}</p>
                <p className="text-[11px] text-muted-foreground">
                  {period === 'week' && `${new Date(item.updatedAt).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })} · `}
                  {new Date(item.updatedAt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function GrocerySummaryDialog({
  open,
  groceries,
  onClose,
}: {
  open: boolean;
  groceries: GroceryItem[];
  onClose: () => void;
}) {
  const [period, setPeriod] = useState<GrocerySummaryPeriod>('week');

  if (!open) return null;

  const now = new Date();
  const { start, end } = getGrocerySummaryRange(period, now);
  const recentGroceries = groceries
    .filter((item) => {
      const updatedAt = Date.parse(item.updatedAt);
      return Number.isFinite(updatedAt) && updatedAt >= start.getTime() && updatedAt < end.getTime();
    })
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const checkedCount = recentGroceries.filter((item) => !item.deleted && item.checked).length;
  const removedCount = recentGroceries.filter((item) => item.deleted).length;
  const outstandingCount = recentGroceries.filter((item) => !item.deleted && !item.checked).length;
  const checkedGroceries = recentGroceries.filter((item) => !item.deleted && item.checked);
  const outstandingGroceries = recentGroceries.filter((item) => !item.deleted && !item.checked);
  const deletedGroceries = recentGroceries.filter((item) => item.deleted);
  const activeUpdatedCount = checkedCount + outstandingCount;
  const completionRate = activeUpdatedCount === 0 ? 0 : Math.round((checkedCount / activeUpdatedCount) * 100);
  const categoryPurchases = new Map<string, number>();
  recentGroceries
    .filter((item) => !item.deleted && item.checked)
    .forEach((item) => {
      const category = item.category || 'Pantry';
      categoryPurchases.set(category, (categoryPurchases.get(category) ?? 0) + 1);
    });
  const mostPurchasedCategory = Array.from(categoryPurchases.entries())
    .sort((a, b) => b[1] - a[1])[0];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-overlay" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="grocery-summary-title"
        className="fixed bottom-0 left-1/2 z-50 max-h-[85dvh] w-full max-w-[480px] -translate-x-1/2 overflow-y-auto rounded-t-2xl bg-card p-6 pb-[max(24px,env(safe-area-inset-bottom))] shadow-lg"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 id="grocery-summary-title" className="font-display text-xl font-extrabold">
              Grocery activity
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {period === 'day' ? 'Today' : 'This week'} · {recentGroceries.length} {recentGroceries.length === 1 ? 'item' : 'items'} updated
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-input px-3 py-2 text-sm font-semibold hover:bg-muted"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="segmented mb-5">
          <button
            type="button"
            aria-pressed={period === 'day'}
            className={period === 'day'
              ? 'py-2 px-3 text-sm font-semibold rounded-md bg-card text-foreground shadow-xs cursor-pointer'
              : 'py-2 px-3 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground cursor-pointer'}
            onClick={() => setPeriod('day')}
          >
            Today
          </button>
          <button
            type="button"
            aria-pressed={period === 'week'}
            className={period === 'week'
              ? 'py-2 px-3 text-sm font-semibold rounded-md bg-card text-foreground shadow-xs cursor-pointer'
              : 'py-2 px-3 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground cursor-pointer'}
            onClick={() => setPeriod('week')}
          >
            This week
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-secondary p-3 text-center">
            <p className="text-xl font-extrabold text-primary">{checkedCount}</p>
            <p className="text-xs text-muted-foreground">Checked off</p>
          </div>
          <div className="rounded-xl bg-muted p-3 text-center">
            <p className="text-xl font-extrabold">{outstandingCount}</p>
            <p className="text-xs text-muted-foreground">Still on list</p>
          </div>
          <div className="rounded-xl bg-peach p-3 text-center">
            <p className="text-xl font-extrabold text-peach-ink">{removedCount}</p>
            <p className="text-xs text-muted-foreground">Deleted</p>
          </div>
        </div>

        <section className="mt-5 rounded-xl border border-primary/15 bg-secondary/60 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Lightbulb className="size-4 text-primary" />
            {period === 'day' ? "Today's insights" : "This week's insights"}
          </h3>
          {recentGroceries.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Add or update grocery items to see activity insights here.
            </p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm text-foreground">
              {activeUpdatedCount > 0 && (
                <li>
                  {completionRate}% of active items updated {period === 'day' ? 'today' : 'this week'} are checked off
                  ({checkedCount} of {activeUpdatedCount}).
                </li>
              )}
              {mostPurchasedCategory && (
                <li>
                  Most commonly purchased: {mostPurchasedCategory[0]} ({mostPurchasedCategory[1]} {mostPurchasedCategory[1] === 1 ? 'item' : 'items'} checked off).
                </li>
              )}
              {outstandingCount > 0 && (
                <li>
                  {outstandingCount} {outstandingCount === 1 ? 'item is' : 'items are'} still on the list and may need attention.
                </li>
              )}
              {removedCount > 0 && (
                <li>
                  {removedCount} {removedCount === 1 ? 'item was' : 'items were'} removed from the list.
                </li>
              )}
            </ul>
          )}
        </section>

        <GroceryActivitySection
          title="Checked out"
          items={checkedGroceries}
          period={period}
          checked
          emptyMessage={`No items checked out ${period === 'day' ? 'today' : 'this week'}.`}
        />
        <GroceryActivitySection
          title="Still on list"
          items={outstandingGroceries}
          period={period}
          emptyMessage={`No items remain on the list from ${period === 'day' ? 'today' : 'this week'}.`}
        />
        <GroceryActivitySection
          title="Deleted"
          items={deletedGroceries}
          period={period}
          deleted
          emptyMessage={`No items deleted ${period === 'day' ? 'today' : 'this week'}.`}
        />
        <p className="mt-4 text-xs text-muted-foreground">
          Activity uses each item’s latest update. Earlier changes to the same item aren’t stored.
        </p>
      </div>
    </>
  );
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
// AddGroceryDialog
// ---------------------------------------------------------------------------
interface AddGroceryForm {
  name: string;
  category: string;
  addedBy: string;
}

function AddGroceryDialog({
  open,
  members,
  onClose,
  onSave,
}: {
  open: boolean;
  members: Member[];
  onClose: () => void;
  onSave: (form: AddGroceryForm) => void;
}) {
  const [form, setForm] = useState<AddGroceryForm>({
    name: '',
    category: 'Produce',
    addedBy: members[0]?.name ?? 'You',
  });

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
    setForm({
      name: '',
      category: 'Produce',
      addedBy: members[0]?.name ?? 'You',
    });
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-overlay"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-grocery-title"
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 rounded-t-2xl bg-card p-6 pb-[max(24px,env(safe-area-inset-bottom))] shadow-lg"
      >
        <h2 id="add-grocery-title" className="font-display text-xl font-extrabold mb-5">
          Add grocery item
        </h2>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label className="form-field">
            Item name
            <input
              required
              autoFocus
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="e.g. Fresh milk, Rice, Bananas"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>

          <label className="form-field">
            Category
            <select
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              {GROCERY_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            Added by
            <select
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
              value={form.addedBy}
              onChange={(e) => setForm((f) => ({ ...f, addedBy: e.target.value }))}
            >
              <option value="You">You</option>
              {members.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name} ({m.roleLabel})
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="h-11 w-full rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors cursor-pointer mt-2"
          >
            Add to list
          </button>
        </form>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// AddBillDialog
// ---------------------------------------------------------------------------
interface AddBillForm {
  name: string;
  amount: string;
  dueDate: string;
  responsibleMemberId: string;
  recurring: boolean;
}

function AddBillDialog({
  open,
  members,
  onClose,
  onSave,
}: {
  open: boolean;
  members: Member[];
  onClose: () => void;
  onSave: (form: AddBillForm) => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState<AddBillForm>({
    name: '',
    amount: '',
    dueDate: today,
    responsibleMemberId: members[0]?.id ?? '',
    recurring: true,
  });

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.amount || !form.dueDate) return;
    onSave(form);
    setForm({
      name: '',
      amount: '',
      dueDate: today,
      responsibleMemberId: members[0]?.id ?? '',
      recurring: true,
    });
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-overlay"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-bill-title"
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 rounded-t-2xl bg-card p-6 pb-[max(24px,env(safe-area-inset-bottom))] shadow-lg"
      >
        <h2 id="add-bill-title" className="font-display text-xl font-extrabold mb-5">
          Add a household bill
        </h2>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label className="form-field">
            Bill name
            <input
              required
              autoFocus
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="e.g. Meralco, Maynilad, Converge"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>

          <label className="form-field">
            Amount (₱)
            <input
              required
              type="number"
              min={1}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="2450"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </label>

          <label className="form-field">
            Due date
            <input
              required
              type="date"
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
          </label>

          <label className="form-field">
            Responsible person
            <select
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
              value={form.responsibleMemberId}
              onChange={(e) => setForm((f) => ({ ...f, responsibleMemberId: e.target.value }))}
            >
              {members.length === 0 ? (
                <option value="">No members registered</option>
              ) : (
                members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.roleLabel}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="flex items-center gap-2.5 text-sm font-medium cursor-pointer pt-1">
            <input
              type="checkbox"
              className="size-4 rounded border-input text-primary focus:ring-primary"
              checked={form.recurring}
              onChange={(e) => setForm((f) => ({ ...f, recurring: e.target.checked }))}
            />
            <span>Recurring monthly (renews automatically when paid)</span>
          </label>

          <button
            type="submit"
            className="h-11 w-full rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors cursor-pointer mt-2"
          >
            Add bill
          </button>
        </form>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// ListsView
// ---------------------------------------------------------------------------
export function ListsView({
  onNavigateToDebts,
}: {
  onNavigateToDebts?: () => void;
}) {
  const [tab, setTab] = useState<'Groceries' | 'Bills'>('Groceries');
  const [addGroceryOpen, setAddGroceryOpen] = useState(false);
  const [scanGroceryOpen, setScanGroceryOpen] = useState(false);
  const [addBillOpen, setAddBillOpen] = useState(false);
  const [grocerySummaryOpen, setGrocerySummaryOpen] = useState(false);

  // Live queries directly from Dexie IndexedDB
  const groceries = useLiveQuery(() => db.groceryItems.toArray(), []) ?? [];
  const bills = useLiveQuery(() => db.bills.toArray(), []) ?? [];
  const members = useLiveQuery(() => db.members.toArray(), []) ?? [];

  const activeMembers = members.filter((m) => !m.deleted);
  const memberMap = new Map(activeMembers.map((m) => [m.id, m]));

  const activeGroceries = groceries.filter((g) => !g.deleted && !g.cleared);
  const activeBills = bills.filter((b) => !b.deleted);

  const remainingGroceries = activeGroceries.filter((g) => !g.checked).length;
  const unpaidBills = activeBills.filter((b) => b.status === 'unpaid');
  const totalUnpaidBills = unpaidBills.reduce((sum, b) => sum + (b.amount || 0), 0);

  // Group groceries by category
  const categoriesPresent = Array.from(new Set(activeGroceries.map((g) => g.category || 'Pantry')));

  // Handlers for Groceries
  async function handleToggleGrocery(id: string, currentChecked: boolean) {
    await db.groceryItems.update(id, {
      checked: !currentChecked,
      updatedAt: new Date().toISOString(),
    });
  }

  async function handleDeleteGrocery(id: string) {
    await db.groceryItems.update(id, {
      deleted: true,
      updatedAt: new Date().toISOString(),
    });
  }

  async function handleClearCheckedGroceries() {
    const checkedItems = activeGroceries.filter((g) => g.checked);
    const now = new Date().toISOString();
    await Promise.all(
      checkedItems.map((item) =>
        db.groceryItems.update(item.id, {
          cleared: true,
          updatedAt: now,
        })
      )
    );
  }

  async function handleAddGrocery(form: AddGroceryForm) {
    const now = new Date().toISOString();
    const item: GroceryItem = {
      id: generateId(),
      householdId: 'household-1',
      name: form.name.trim(),
      category: form.category,
      checked: false,
      addedBy: form.addedBy,
      updatedAt: now,
      updatedBy: 'me',
      deleted: false,
    };
    await db.groceryItems.add(item);
  }

  // Handlers for Bills
  async function handleToggleBillPaid(bill: Bill) {
    const nextStatus = bill.status === 'paid' ? 'unpaid' : 'paid';
    const now = new Date().toISOString();

    await db.bills.update(bill.id, {
      status: nextStatus,
      updatedAt: now,
    });

    // Technical Requirement Rule:
    // Marking a recurring bill paid creates next month's bill with same name and amount,
    // clamped to the last day of shorter months, guarding against duplicate next bills.
    if (nextStatus === 'paid' && bill.recurring) {
      const nextDueDate = getNextMonthDueDate(bill.dueDate);
      const existingNext = activeBills.find(
        (b) =>
          b.name.trim().toLowerCase() === bill.name.trim().toLowerCase() &&
          b.dueDate === nextDueDate
      );

      if (!existingNext) {
        const nextBill: Bill = {
          id: generateId(),
          householdId: bill.householdId,
          name: bill.name,
          amount: bill.amount,
          dueDate: nextDueDate,
          status: 'unpaid',
          responsibleMemberId: bill.responsibleMemberId,
          recurring: true,
          updatedAt: now,
          updatedBy: 'me',
          deleted: false,
        };
        await db.bills.add(nextBill);
      }
    }
  }

  async function handleAddBill(form: AddBillForm) {
    const now = new Date().toISOString();
    const bill: Bill = {
      id: generateId(),
      householdId: 'household-1',
      name: form.name.trim(),
      amount: Number(form.amount),
      dueDate: form.dueDate,
      status: 'unpaid',
      responsibleMemberId: form.responsibleMemberId || (activeMembers[0]?.id ?? 'me'),
      recurring: form.recurring,
      updatedAt: now,
      updatedBy: 'me',
      deleted: false,
    };
    await db.bills.add(bill);
  }

  return (
    <>
      <PageHeading
        title="Household lists"
        subtitle="Less remembering. More living."
        onAdd={() => {
          if (tab === 'Groceries') setAddGroceryOpen(true);
          else setAddBillOpen(true);
        }}
      />

      {/* Segmented Tab Switcher */}
      <div className="segmented">
        <button
          type="button"
          className={
            tab === 'Groceries'
              ? 'py-2 px-3 text-sm font-semibold rounded-md bg-card text-foreground shadow-xs cursor-pointer'
              : 'py-2 px-3 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground cursor-pointer'
          }
          onClick={() => setTab('Groceries')}
        >
          Groceries
        </button>
        <button
          type="button"
          className={
            tab === 'Bills'
              ? 'py-2 px-3 text-sm font-semibold rounded-md bg-card text-foreground shadow-xs cursor-pointer'
              : 'py-2 px-3 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground cursor-pointer'
          }
          onClick={() => setTab('Bills')}
        >
          Bills
        </button>
      </div>

      {tab === 'Groceries' ? (
        <>
          {/* Scan with Computer Vision button */}
          <button
            type="button"
            className="w-full h-12 mb-4 inline-flex items-center justify-center gap-2 rounded-lg bg-secondary text-primary font-semibold hover:bg-secondary/80 transition-colors cursor-pointer"
            onClick={() => setScanGroceryOpen(true)}
          >
            <Camera className="size-5" />
            Scan grocery item (Camera / Library)
          </button>

          {/* Grocery header summary */}
          <div className="flex justify-between items-center mb-5">
            <span className="text-sm font-semibold">
              {remainingGroceries === 0
                ? 'All caught up'
                : `${remainingGroceries} ${remainingGroceries === 1 ? 'item' : 'items'} to pick up`}
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-secondary"
              onClick={() => setGrocerySummaryOpen(true)}
            >
              <Activity className="size-3.5" />
              Activity summary
            </button>
          </div>

          {/* Grocery items grouped by category */}
          {activeGroceries.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <ShoppingBasket className="mx-auto mb-3 size-8 text-muted-foreground/70" />
              <p className="text-sm font-medium">Your grocery list is empty.</p>
              <p className="text-xs mt-1 text-muted-foreground/80">
                Scan what you are holding or add pantry items manually.
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <button
                  type="button"
                  className="text-sm font-semibold text-primary underline-offset-4 hover:underline cursor-pointer"
                  onClick={() => setAddGroceryOpen(true)}
                >
                  Add manually
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  className="text-sm font-semibold text-primary underline-offset-4 hover:underline cursor-pointer inline-flex items-center gap-1"
                  onClick={() => setScanGroceryOpen(true)}
                >
                  <Camera className="size-3.5" />
                  Scan with camera
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {categoriesPresent.map((category) => {
                const itemsInCat = activeGroceries.filter(
                  (g) => (g.category || 'Pantry') === category
                );
                if (itemsInCat.length === 0) return null;

                return (
                  <section key={category}>
                    <h2 className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
                      {category}
                    </h2>
                    <div className="divide-y divide-border">
                      {itemsInCat.map((item) => (
                        <div className="list-row group" key={item.id}>
                          <button
                            type="button"
                            className="p-1 -ml-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                            aria-label={item.checked ? `Move ${item.name} back to the list` : `Check out ${item.name}`}
                            title={item.checked ? 'Move back to list' : 'Check out'}
                            onClick={() => handleToggleGrocery(item.id, item.checked)}
                          >
                            {item.checked ? (
                              <CheckCircle2 className="size-6 text-primary" />
                            ) : (
                              <Circle className="size-6 text-muted-foreground" />
                            )}
                          </button>
                          <div className="min-w-0 pr-2">
                            <h3
                              className={
                                item.checked
                                  ? 'line-through text-muted-foreground font-normal'
                                  : 'font-semibold'
                              }
                            >
                              {item.name}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              Added by {item.addedBy || 'Family'}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="p-1 text-muted-foreground/40 hover:text-destructive transition-colors cursor-pointer"
                            aria-label={`Delete ${item.name} from the grocery list`}
                            title="Delete item"
                            onClick={() => handleDeleteGrocery(item.id)}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}

              <div className="pt-2 flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="h-11 inline-flex items-center justify-center gap-1.5 rounded-lg border border-input bg-card font-medium text-sm hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                    onClick={() => setAddGroceryOpen(true)}
                  >
                    <Plus className="size-4" />
                    Add manual
                  </button>
                  <button
                    type="button"
                    className="h-11 inline-flex items-center justify-center gap-1.5 rounded-lg bg-secondary text-primary font-medium text-sm hover:bg-secondary/80 transition-colors cursor-pointer"
                    onClick={() => setScanGroceryOpen(true)}
                  >
                    <Camera className="size-4" />
                    Scan item
                  </button>
                </div>

                {activeGroceries.some((g) => g.checked) && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-destructive py-2 transition-colors cursor-pointer text-center"
                    onClick={handleClearCheckedGroceries}
                  >
                    Clear completed items
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Bills balance band */}
          <div className="balance-band">
            <span className="text-sm">Household bills</span>
            <strong>
              {totalUnpaidBills === 0 ? '₱0' : formatAmount(totalUnpaidBills)}
            </strong>
            <span className="text-xs text-muted-foreground">
              {unpaidBills.length === 0
                ? 'All caught up.'
                : `${unpaidBills.length} ${unpaidBills.length === 1 ? 'bill' : 'bills'} to take care of`}
            </span>
          </div>

          {/* Bills list */}
          {activeBills.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Receipt className="mx-auto mb-3 size-8 text-muted-foreground/70" />
              <p className="text-sm font-medium">No household bills yet.</p>
              <p className="text-xs mt-1 text-muted-foreground/80">
                Track electricity, water, internet, and other utilities.
              </p>
              <button
                className="mt-4 text-sm font-semibold text-primary underline-offset-4 hover:underline cursor-pointer"
                onClick={() => setAddBillOpen(true)}
              >
                Add a bill
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {activeBills.map((bill) => {
                const responsible = memberMap.get(bill.responsibleMemberId);
                const isPaid = bill.status === 'paid';

                return (
                  <div className="list-row" key={bill.id}>
                    <span className="feature-icon bg-sky text-sky-ink">
                      <House className="size-5" />
                    </span>
                    <div className="min-w-0 pr-2">
                      <h3 className={isPaid ? 'line-through text-muted-foreground font-normal' : 'font-semibold'}>
                        {bill.name}
                      </h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="size-3 shrink-0" />
                        Due {formatDueDate(bill.dueDate)}
                        {responsible ? ` · ${responsible.name}` : ''}
                        {bill.recurring ? ' · Monthly' : ''}
                      </p>
                      <p className="font-semibold text-sm mt-0.5">
                        {formatAmount(bill.amount)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={
                        isPaid
                          ? 'inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium bg-secondary text-primary hover:bg-secondary/80 transition-colors cursor-pointer'
                          : 'inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer'
                      }
                      onClick={() => handleToggleBillPaid(bill)}
                      aria-label={isPaid ? `Mark ${bill.name} unpaid` : `Mark ${bill.name} paid`}
                    >
                      {isPaid ? (
                        <>
                          <Check className="size-4" /> Paid
                        </>
                      ) : (
                        'Mark paid'
                      )}
                    </button>
                  </div>
                );
              })}

              <div className="pt-4">
                <button
                  type="button"
                  className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg border border-input bg-card font-medium text-sm hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                  onClick={() => setAddBillOpen(true)}
                >
                  <Plus className="size-4" />
                  Add a bill
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Cross-navigation to Family Balances (matching reference UI) */}
      {onNavigateToDebts && (
        <button
          type="button"
          className="inline-flex items-center justify-center gap-1.5 w-full mt-7 text-sm font-semibold text-primary hover:underline cursor-pointer"
          onClick={onNavigateToDebts}
        >
          <ArrowLeftRight className="size-4" />
          Family balances
          <ChevronRight className="size-3.5" />
        </button>
      )}

      {/* Add Dialogs */}
      <AddGroceryDialog
        open={addGroceryOpen}
        members={activeMembers}
        onClose={() => setAddGroceryOpen(false)}
        onSave={handleAddGrocery}
      />

      <GrocerySummaryDialog
        open={grocerySummaryOpen}
        groceries={groceries}
        onClose={() => setGrocerySummaryOpen(false)}
      />

      <AddBillDialog
        open={addBillOpen}
        members={activeMembers}
        onClose={() => setAddBillOpen(false)}
        onSave={handleAddBill}
      />

      {/* On-Device Computer Vision Scanner */}
      <ScanGroceryModal
        open={scanGroceryOpen}
        members={activeMembers}
        onClose={() => setScanGroceryOpen(false)}
        onConfirmItem={handleAddGrocery}
      />
    </>
  );
}
