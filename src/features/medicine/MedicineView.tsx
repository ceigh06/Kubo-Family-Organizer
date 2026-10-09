import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Plus,
  Pill,
  Clock,
  Users,
  CheckCircle2,
  Check,
  MoreHorizontal,
  ScanLine,
  ShieldCheck,
  AlertTriangle,
  Camera,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { db } from '@/db';
import type { Medicine, DoseLog, Member } from '@/db/schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultScheduledTimes(timesPerDay: number): string[] {
  switch (timesPerDay) {
    case 1:
      return ['08:00'];
    case 2:
      return ['08:00', '20:00'];
    case 3:
      return ['08:00', '13:00', '20:00'];
    case 4:
      return ['08:00', '12:00', '16:00', '20:00'];
    default:
      return ['08:00'];
  }
}

function formatTimeDisplay(timeStr?: string): string {
  if (!timeStr) return '—';
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    let hour = parseInt(parts[0], 10);
    const minute = parts[1];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${ampm}`;
  }
  return timeStr;
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
// AddMedicineDialog
// ---------------------------------------------------------------------------
interface AddMedicineForm {
  name: string;
  dosage: string;
  type: 'maintenance' | 'PRN';
  timesPerDay: number;
  scheduledTime1: string;
  scheduledTime2: string;
  instructions: string;
  stock: string;
  refillThreshold: string;
  memberId: string;
  minIntervalHours: string;
}

function AddMedicineDialog({
  open,
  members,
  onClose,
  onSave,
  initialValues,
}: {
  open: boolean;
  members: Member[];
  onClose: () => void;
  onSave: (form: AddMedicineForm) => void;
  initialValues?: Partial<AddMedicineForm>;
}) {
  const [form, setForm] = useState<AddMedicineForm>({
    name: initialValues?.name ?? '',
    dosage: initialValues?.dosage ?? '50 mg · 1 tablet',
    type: initialValues?.type ?? 'maintenance',
    timesPerDay: initialValues?.timesPerDay ?? 1,
    scheduledTime1: initialValues?.scheduledTime1 ?? '08:00',
    scheduledTime2: initialValues?.scheduledTime2 ?? '20:00',
    instructions: initialValues?.instructions ?? 'Take with water after meals',
    stock: initialValues?.stock ?? '30',
    refillThreshold: initialValues?.refillThreshold ?? '7',
    memberId: initialValues?.memberId ?? (members[0]?.id ?? 'me'),
    minIntervalHours: initialValues?.minIntervalHours ?? '4',
  });

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-overlay" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-med-title"
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 rounded-t-2xl bg-card p-6 pb-[max(24px,env(safe-area-inset-bottom))] shadow-lg max-h-[90dvh] overflow-y-auto"
      >
        <h2 id="add-med-title" className="font-display text-xl font-extrabold mb-4">
          Add medicine
        </h2>

        {/* Type selector */}
        <div className="segmented mb-4">
          <button
            type="button"
            className={
              form.type === 'maintenance'
                ? 'py-2 px-3 text-sm font-semibold rounded-md bg-card text-foreground shadow-xs cursor-pointer'
                : 'py-2 px-3 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground cursor-pointer'
            }
            onClick={() => setForm((f) => ({ ...f, type: 'maintenance' }))}
          >
            Maintenance (Scheduled)
          </button>
          <button
            type="button"
            className={
              form.type === 'PRN'
                ? 'py-2 px-3 text-sm font-semibold rounded-md bg-card text-foreground shadow-xs cursor-pointer'
                : 'py-2 px-3 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground cursor-pointer'
            }
            onClick={() => setForm((f) => ({ ...f, type: 'PRN' }))}
          >
            PRN (As needed)
          </button>
        </div>

        <form className="grid gap-3.5" onSubmit={handleSubmit}>
          <label className="form-field">
            Medicine name
            <input
              required
              autoFocus
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="e.g. Losartan, Vitamin C, Paracetamol"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>

          <label className="form-field">
            Dosage
            <input
              required
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="e.g. 50 mg · 1 tablet"
              value={form.dosage}
              onChange={(e) => setForm((f) => ({ ...f, dosage: e.target.value }))}
            />
          </label>

          <label className="form-field">
            For family member
            <select
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
              value={form.memberId}
              onChange={(e) => setForm((f) => ({ ...f, memberId: e.target.value }))}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.roleLabel}
                </option>
              ))}
            </select>
          </label>

          {form.type === 'maintenance' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="form-field">
                  Times per day
                  <select
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
                    value={form.timesPerDay}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, timesPerDay: Number(e.target.value) }))
                    }
                  >
                    <option value={1}>1 time daily</option>
                    <option value={2}>2 times daily</option>
                    <option value={3}>3 times daily</option>
                  </select>
                </label>
                <label className="form-field">
                  First dose time
                  <input
                    type="time"
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
                    value={form.scheduledTime1}
                    onChange={(e) => setForm((f) => ({ ...f, scheduledTime1: e.target.value }))}
                  />
                </label>
              </div>
              {form.timesPerDay >= 2 && (
                <label className="form-field">
                  Second dose time
                  <input
                    type="time"
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
                    value={form.scheduledTime2}
                    onChange={(e) => setForm((f) => ({ ...f, scheduledTime2: e.target.value }))}
                  />
                </label>
              )}
            </>
          ) : (
            <label className="form-field">
              Minimum interval between doses (hours)
              <input
                type="number"
                min={1}
                max={24}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.minIntervalHours}
                onChange={(e) => setForm((f) => ({ ...f, minIntervalHours: e.target.value }))}
              />
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="form-field">
              Current stock (count)
              <input
                required
                type="number"
                min={0}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.stock}
                onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
              />
            </label>
            <label className="form-field">
              Refill threshold
              <input
                required
                type="number"
                min={1}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.refillThreshold}
                onChange={(e) =>
                  setForm((f) => ({ ...f, refillThreshold: e.target.value }))
                }
              />
            </label>
          </div>

          <label className="form-field">
            Instructions
            <input
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="e.g. Take with food, After breakfast"
              value={form.instructions}
              onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
            />
          </label>

          <p className="prototype-note">
            Kubo logs doses locally. Follow your healthcare provider’s prescription.
          </p>

          <button
            type="submit"
            className="h-11 w-full rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors cursor-pointer mt-1"
          >
            Save medicine
          </button>
        </form>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// ScanMedicineModal
// ---------------------------------------------------------------------------
function ScanMedicineModal({
  open,
  onClose,
  onApplyExtracted,
}: {
  open: boolean;
  onClose: () => void;
  onApplyExtracted: (med: Partial<AddMedicineForm>) => void;
}) {
  const [step, setStep] = useState<0 | 1>(0);

  if (!open) return null;

  function handleTrySample() {
    setStep(1);
  }

  function handleConfirmSample() {
    onApplyExtracted({
      name: 'Losartan Potassium',
      dosage: '50 mg · 1 tablet',
      type: 'maintenance',
      timesPerDay: 1,
      scheduledTime1: '08:00',
      stock: '30',
      refillThreshold: '7',
      instructions: 'Take 1 tablet daily with or without food',
    });
    setStep(0);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-overlay" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scan-title"
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 rounded-t-2xl bg-card p-6 pb-[max(24px,env(safe-area-inset-bottom))] shadow-lg"
      >
        <h2 id="scan-title" className="font-display text-xl font-extrabold mb-4">
          {step === 0 ? 'Scan medicine box or prescription' : 'Review scanned details'}
        </h2>

        {step === 0 ? (
          <div className="space-y-4">
            <div className="scan-stage">
              <div className="scan-frame">
                <Pill className="size-12" />
              </div>
              <h3 className="font-bold text-sm">Align medicine box in frame</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
                On-device OCR extracts dosage, medicine name, and schedule without sending images to the cloud.
              </p>
            </div>

            <button
              type="button"
              className="h-11 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
              onClick={handleTrySample}
            >
              <Camera className="size-4" />
              Try sample box scan
            </button>

            <button
              type="button"
              className="w-full text-center text-sm font-semibold text-primary underline-offset-4 hover:underline py-1 cursor-pointer"
              onClick={() => {
                onClose();
                onApplyExtracted({});
              }}
            >
              Enter details manually instead
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <span className="pill-label bg-secondary text-primary inline-flex items-center gap-1">
              <Check className="size-3" /> Sample extraction ready
            </span>

            <div className="rounded-lg border border-border p-4 space-y-2 bg-muted/40">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-base">Losartan Potassium</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">50 mg · 1 tablet</p>
                </div>
                <span className="pill-label bg-muted">Maintenance</span>
              </div>
              <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                Schedule: 08:00 AM daily · 30 tablets
              </p>
            </div>

            <p className="prototype-note">
              Always verify the scanned information against the physical prescription label before saving.
            </p>

            <button
              type="button"
              className="h-11 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
              onClick={handleConfirmSample}
            >
              <Check className="size-4" />
              Confirm & prefill form
            </button>

            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-1 cursor-pointer"
              onClick={() => setStep(0)}
            >
              Back to scan stage
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// DoseCard Component
// ---------------------------------------------------------------------------
interface DoseCardProps {
  medicine: Medicine;
  member?: Member;
  todayLogs: DoseLog[];
  onTake: (medicine: Medicine, scheduledTime: string) => void;
  onSkip: (medicine: Medicine, scheduledTime: string) => void;
  onSnooze: (medicine: Medicine, scheduledTime: string) => void;
  onUndo: (doseLogId: string, medicineId: string) => void;
  onDelete: (medicineId: string) => void;
}

function DoseCard({
  medicine,
  member,
  todayLogs,
  onTake,
  onSkip,
  onSnooze,
  onUndo,
  onDelete,
}: DoseCardProps) {
  const isMaintenance = medicine.type === 'maintenance';
  const scheduledTimes =
    medicine.scheduledTimes && medicine.scheduledTimes.length > 0
      ? medicine.scheduledTimes
      : getDefaultScheduledTimes(medicine.timesPerDay || 1);

  // For maintenance, determine primary upcoming/current slot for today
  const primaryTime = scheduledTimes[0] || '08:00';
  const matchingLog = todayLogs.find((l) => l.medicineId === medicine.id);

  // Status calculation
  let status = 'Upcoming';
  let isTaken = false;

  if (isMaintenance) {
    if (matchingLog) {
      if (matchingLog.status === 'taken') {
        status = 'Taken';
        isTaken = true;
      } else if (matchingLog.status === 'skipped') {
        status = 'Skipped';
      } else if (matchingLog.status === 'missed') {
        status = 'Missed';
      } else if (matchingLog.status === 'snoozed') {
        status = (matchingLog.snoozeCount ?? 1) >= 3 ? 'Missed' : 'Snoozed';
      }
    } else {
      // Compare slot with current time
      const now = new Date();
      const currentH = now.getHours();
      const currentM = now.getMinutes();
      const [slotH, slotM] = primaryTime.split(':').map((n) => parseInt(n, 10));
      if (currentH > slotH || (currentH === slotH && currentM >= slotM)) {
        status = 'Due now';
      } else {
        status = 'Upcoming';
      }
    }
  } else {
    // PRN medicine
    const latestTakenLog = todayLogs
      .filter((l) => l.medicineId === medicine.id && l.status === 'taken')
      .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))[0];

    if (latestTakenLog) {
      const minInterval = medicine.minIntervalHours || 4;
      const elapsedHours =
        (Date.now() - new Date(latestTakenLog.loggedAt).getTime()) / (1000 * 60 * 60);
      if (elapsedHours < minInterval) {
        status = `Taken ${Math.round(elapsedHours)}h ago`;
      } else {
        status = 'As needed';
      }
    } else {
      status = 'As needed';
    }
  }

  const isLowStock = medicine.stock <= medicine.refillThreshold;

  return (
    <article className="dose-card">
      <div className="dose-header">
        <span className="feature-icon bg-secondary text-primary">
          <Pill className="size-5" />
        </span>
        <div className="min-w-0 pr-1">
          <h3 className="truncate">{medicine.name}</h3>
          <p>{medicine.dosage}</p>
        </div>
        <span
          className={`pill-label ${
            status === 'Due now'
              ? 'bg-peach text-peach-ink font-bold'
              : status === 'Taken'
              ? 'bg-secondary text-primary'
              : status === 'Missed'
              ? 'bg-destructive/15 text-destructive font-semibold'
              : 'bg-muted text-foreground'
          }`}
        >
          {status}
        </span>
      </div>

      <div className="dose-detail">
        <Clock className="size-3.5 shrink-0" />
        <span>{isMaintenance ? formatTimeDisplay(primaryTime) : 'As needed'}</span>
        <span className="mx-1">·</span>
        <span className="truncate">{member ? member.name : 'Family'}</span>
        <span className="ml-auto pill-label bg-muted capitalize">{medicine.type}</span>
      </div>

      {medicine.instructions && (
        <p className="text-xs text-muted-foreground -mt-1 mb-3 italic">
          "{medicine.instructions}"
        </p>
      )}

      {/* Action buttons */}
      {isTaken ? (
        <button
          type="button"
          className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-secondary text-primary font-semibold hover:bg-secondary/80 transition-colors cursor-pointer"
          onClick={() => {
            if (matchingLog) onUndo(matchingLog.id, medicine.id);
          }}
        >
          <CheckCircle2 className="size-4" />
          Taken · tap to undo
        </button>
      ) : (
        <div className="dose-actions">
          <button
            type="button"
            className="h-11 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors cursor-pointer text-sm"
            onClick={() => onTake(medicine, primaryTime)}
          >
            <Check className="size-4" />
            Mark as taken
          </button>
          <button
            type="button"
            className="h-11 w-11 inline-flex items-center justify-center rounded-lg border border-input bg-card text-foreground hover:bg-accent cursor-pointer transition-colors"
            title="Snooze for 10 minutes"
            aria-label={`Snooze ${medicine.name}`}
            onClick={() => onSnooze(medicine, primaryTime)}
          >
            <Clock className="size-4" />
          </button>
          <button
            type="button"
            className="h-11 w-11 inline-flex items-center justify-center rounded-lg border border-input bg-card text-foreground hover:bg-accent cursor-pointer transition-colors"
            title="Skip this dose"
            aria-label={`Skip ${medicine.name}`}
            onClick={() => onSkip(medicine, primaryTime)}
          >
            <MoreHorizontal className="size-4" />
          </button>
        </div>
      )}

      <div className="dose-footer">
        <Users className="size-3" />
        <span>Visible to family</span>
        <div className="ml-auto flex items-center gap-2">
          {isLowStock && (
            <span className="pill-label bg-peach text-peach-ink font-semibold flex items-center gap-0.5">
              <AlertTriangle className="size-3" /> Low stock
            </span>
          )}
          <span className={isLowStock ? 'font-bold text-destructive' : ''}>
            {medicine.stock} {medicine.stock === 1 ? 'tablet' : 'tablets'} left
          </span>
          <button
            type="button"
            className="p-1 -mr-1 text-muted-foreground/40 hover:text-destructive transition-colors cursor-pointer"
            aria-label={`Delete ${medicine.name}`}
            onClick={() => onDelete(medicine.id)}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// MedicineView Main Component
// ---------------------------------------------------------------------------
export function MedicineView() {
  const [filter, setFilter] = useState<'All' | 'Maintenance' | 'PRN'>('All');
  const [addOpen, setAddOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<Partial<AddMedicineForm>>({});

  // Dexie live queries
  const medicines = useLiveQuery(() => db.medicines.toArray(), []) ?? [];
  const doseLogs = useLiveQuery(() => db.doseLogs.toArray(), []) ?? [];
  const members = useLiveQuery(() => db.members.toArray(), []) ?? [];

  const activeMembers = members.filter((m) => !m.deleted);
  const memberMap = new Map(activeMembers.map((m) => [m.id, m]));

  const activeMedicines = medicines.filter((m) => !m.deleted);
  const todayStr = getTodayDateString();
  const todayLogs = doseLogs.filter(
    (l) => !l.deleted && (l.scheduledAt?.startsWith(todayStr) || l.loggedAt?.startsWith(todayStr))
  );

  // Filtered medicines
  const filteredMedicines = activeMedicines.filter((m) => {
    if (filter === 'All') return true;
    if (filter === 'Maintenance') return m.type === 'maintenance';
    if (filter === 'PRN') return m.type === 'PRN';
    return true;
  });

  // Low stock alert detection
  const lowStockMedicines = activeMedicines.filter((m) => m.stock <= m.refillThreshold);

  // Dose engine handlers
  async function handleTake(medicine: Medicine, scheduledTime: string) {
    const now = new Date().toISOString();
    const scheduledAt = `${todayStr}T${scheduledTime}:00`;

    // For PRN: Check if taken within minIntervalHours
    if (medicine.type === 'PRN') {
      const minInterval = medicine.minIntervalHours || 4;
      const recentTaken = doseLogs
        .filter((l) => !l.deleted && l.medicineId === medicine.id && l.status === 'taken')
        .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))[0];

      if (recentTaken) {
        const elapsedHours =
          (Date.now() - new Date(recentTaken.loggedAt).getTime()) / (1000 * 60 * 60);
        if (elapsedHours < minInterval) {
          const proceed = window.confirm(
            `Warning: This dose was taken ${elapsedHours.toFixed(1)}h ago. Recommended minimum interval is ${minInterval}h.\nDo you still want to log this dose?`
          );
          if (!proceed) return;
        }
      }
    }

    // Atomic Dexie transaction: write doseLog + decrement stock
    await db.transaction('rw', [db.medicines, db.doseLogs], async () => {
      const current = await db.medicines.get(medicine.id);
      if (!current) return;
      const nextStock = Math.max(0, current.stock - 1);
      await db.medicines.update(medicine.id, {
        stock: nextStock,
        updatedAt: now,
      });
      await db.doseLogs.add({
        id: generateId(),
        medicineId: medicine.id,
        scheduledAt,
        status: 'taken',
        loggedBy: 'me',
        loggedAt: now,
        updatedAt: now,
        updatedBy: 'me',
        deleted: false,
      });
    });
  }

  async function handleSkip(medicine: Medicine, scheduledTime: string) {
    const now = new Date().toISOString();
    const scheduledAt = `${todayStr}T${scheduledTime}:00`;

    // Skipped does NOT decrement stock
    await db.doseLogs.add({
      id: generateId(),
      medicineId: medicine.id,
      scheduledAt,
      status: 'skipped',
      loggedBy: 'me',
      loggedAt: now,
      updatedAt: now,
      updatedBy: 'me',
      deleted: false,
    });
  }

  async function handleSnooze(medicine: Medicine, scheduledTime: string) {
    const now = new Date().toISOString();
    const scheduledAt = `${todayStr}T${scheduledTime}:00`;

    const existingLog = todayLogs.find((l) => l.medicineId === medicine.id);
    const count = (existingLog?.snoozeCount ?? 0) + 1;
    const finalStatus = count >= 3 ? 'missed' : 'snoozed';

    if (existingLog) {
      await db.doseLogs.update(existingLog.id, {
        status: finalStatus,
        snoozeCount: count,
        updatedAt: now,
      });
    } else {
      await db.doseLogs.add({
        id: generateId(),
        medicineId: medicine.id,
        scheduledAt,
        status: finalStatus,
        snoozeCount: count,
        loggedBy: 'me',
        loggedAt: now,
        updatedAt: now,
        updatedBy: 'me',
        deleted: false,
      });
    }
  }

  async function handleUndo(doseLogId: string, medicineId: string) {
    const now = new Date().toISOString();
    // Restores stock by 1 and removes doseLog
    await db.transaction('rw', [db.medicines, db.doseLogs], async () => {
      const current = await db.medicines.get(medicineId);
      if (current) {
        await db.medicines.update(medicineId, {
          stock: current.stock + 1,
          updatedAt: now,
        });
      }
      await db.doseLogs.delete(doseLogId);
    });
  }

  async function handleDeleteMedicine(medicineId: string) {
    const now = new Date().toISOString();
    await db.medicines.update(medicineId, {
      deleted: true,
      updatedAt: now,
    });
  }

  async function handleSaveNewMedicine(form: AddMedicineForm) {
    const now = new Date().toISOString();
    const scheduledTimes: string[] = [];
    if (form.type === 'maintenance') {
      scheduledTimes.push(form.scheduledTime1);
      if (form.timesPerDay >= 2 && form.scheduledTime2) {
        scheduledTimes.push(form.scheduledTime2);
      }
    }

    const newMed: Medicine = {
      id: generateId(),
      memberId: form.memberId,
      name: form.name.trim(),
      dosage: form.dosage.trim(),
      type: form.type,
      timesPerDay: form.timesPerDay,
      scheduledTimes: scheduledTimes.length > 0 ? scheduledTimes : undefined,
      instructions: form.instructions.trim(),
      stock: parseInt(form.stock, 10) || 30,
      refillThreshold: parseInt(form.refillThreshold, 10) || 7,
      minIntervalHours: parseInt(form.minIntervalHours, 10) || 4,
      updatedAt: now,
      updatedBy: 'me',
      deleted: false,
    };

    await db.medicines.add(newMed);
  }

  return (
    <>
      <PageHeading
        title="A dose of care"
        subtitle="Looking after each other, every day."
        onAdd={() => {
          setFormInitial({});
          setAddOpen(true);
        }}
      />

      {/* Scan a medicine button */}
      <button
        type="button"
        className="w-full h-12 mb-4 inline-flex items-center justify-center gap-2 rounded-lg bg-secondary text-primary font-semibold hover:bg-secondary/80 transition-colors cursor-pointer"
        onClick={() => setScanOpen(true)}
      >
        <ScanLine className="size-5" />
        Scan a medicine
      </button>

      {/* Low stock alerts band */}
      {lowStockMedicines.length > 0 && (
        <div className="mb-4 rounded-lg bg-peach/50 border border-peach-ink/20 p-3 flex items-start gap-2.5 text-xs text-peach-ink">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <div>
            <strong>Refill needed:</strong>{' '}
            {lowStockMedicines.map((m) => `${m.name} (${m.stock} left)`).join(', ')}
          </div>
        </div>
      )}

      {/* Filter Segmented Control */}
      <div className="segmented">
        {(['All', 'Maintenance', 'PRN'] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={
              filter === f
                ? 'py-2 px-3 text-sm font-semibold rounded-md bg-card text-foreground shadow-xs cursor-pointer'
                : 'py-2 px-3 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground cursor-pointer'
            }
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Medicine list */}
      {filteredMedicines.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Pill className="mx-auto mb-3 size-8 text-muted-foreground/70" />
          <p className="text-sm font-medium">No medicines in cabinet yet.</p>
          <p className="text-xs mt-1 text-muted-foreground/80">
            Keep track of daily maintenance and as-needed prescriptions.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <button
              type="button"
              className="text-sm font-semibold text-primary underline-offset-4 hover:underline cursor-pointer"
              onClick={() => {
                setFormInitial({});
                setAddOpen(true);
              }}
            >
              Add a medicine
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              type="button"
              className="text-sm font-semibold text-primary underline-offset-4 hover:underline cursor-pointer"
              onClick={() => setScanOpen(true)}
            >
              Scan a box
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredMedicines.map((med) => (
            <DoseCard
              key={med.id}
              medicine={med}
              member={memberMap.get(med.memberId)}
              todayLogs={todayLogs}
              onTake={handleTake}
              onSkip={handleSkip}
              onSnooze={handleSnooze}
              onUndo={handleUndo}
              onDelete={handleDeleteMedicine}
            />
          ))}
        </div>
      )}

      {/* Medical Safety Disclaimer */}
      <p className="prototype-note mt-6 flex gap-2">
        <ShieldCheck className="size-4 shrink-0 text-primary" />
        Kubo is a reminder tool, not medical advice. Follow your doctor’s or pharmacist’s
        instructions.
      </p>

      {/* Add Medicine Dialog */}
      <AddMedicineDialog
        open={addOpen}
        members={activeMembers}
        initialValues={formInitial}
        onClose={() => setAddOpen(false)}
        onSave={handleSaveNewMedicine}
      />

      {/* Scan Medicine Modal */}
      <ScanMedicineModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onApplyExtracted={(extracted) => {
          setFormInitial(extracted);
          setAddOpen(true);
        }}
      />
    </>
  );
}
