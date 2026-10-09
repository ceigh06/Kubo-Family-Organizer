import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  MapPin,
  CheckCircle2,
  Circle,
  Trash2,
  Cake,
  Bell,
  BellRing,
  Users,
  Pencil,
} from 'lucide-react';
import { db } from '@/db';
import type { CalendarEvent, CalendarRecurrence, Reminder, Member } from '@/db/schema';
import { getCurrentMemberId } from '@/features/household/currentMember';

type CalendarEventOccurrence = CalendarEvent & { occurrenceDate: string };
type ReminderOccurrence = Reminder & { occurrenceDate: string; occurrenceDone: boolean };

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_SHORT = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];

function padZero(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${padZero(month + 1)}-${padZero(day)}`;
}

function dateToUtcDays(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function getRecurrenceDates(
  startDate: string,
  recurrence: CalendarRecurrence | undefined,
  recurrenceUntil: string | undefined,
  rangeStart: string,
  rangeEnd: string,
): string[] {
  if (!recurrence || !recurrenceUntil) {
    return startDate >= rangeStart && startDate <= rangeEnd ? [startDate] : [];
  }

  const firstDate = startDate > rangeStart ? startDate : rangeStart;
  const lastDate = recurrenceUntil < rangeEnd ? recurrenceUntil : rangeEnd;
  if (firstDate > lastDate) return [];

  const dates: string[] = [];
  for (let dayOffset = dateToUtcDays(firstDate); dayOffset <= dateToUtcDays(lastDate); dayOffset += 1) {
    const date = new Date(dayOffset * 86_400_000).toISOString().slice(0, 10);
    const dayDifference = dateToUtcDays(date) - dateToUtcDays(startDate);
    const matches = recurrence === 'daily'
      || (recurrence === 'weekly' && dayDifference % 7 === 0)
      || (recurrence === 'monthly' && date.slice(8) === startDate.slice(8));
    if (matches) dates.push(date);
  }
  return dates;
}

function getReminderStatus(date: string, time: string | undefined, done: boolean): 'Done' | 'Overdue' | 'Due soon' | 'Upcoming' {
  if (done) return 'Done';
  const dueAt = new Date(`${date}T${time || '23:59'}`).getTime();
  const now = Date.now();
  if (dueAt < now) return 'Overdue';
  if (dueAt - now <= 24 * 60 * 60 * 1000) return 'Due soon';
  return 'Upcoming';
}

function parseBirthday(birthdayStr?: string): { month: number; day: number } | null {
  if (!birthdayStr) return null;
  const parts = birthdayStr.split('-');
  if (parts.length === 3) {
    return { month: parseInt(parts[1], 10) - 1, day: parseInt(parts[2], 10) };
  }
  const tokens = birthdayStr.toLowerCase().split(' ');
  if (tokens.length >= 2) {
    const mIdx = MONTH_NAMES.findIndex((m) =>
      m.toLowerCase().startsWith(tokens[0].slice(0, 3))
    );
    const day = parseInt(tokens[1], 10);
    if (mIdx !== -1 && !isNaN(day)) {
      return { month: mIdx, day };
    }
  }
  return null;
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
          className="inline-flex items-center justify-center h-11 w-11 rounded-full bg-[#112314] text-white hover:bg-[#1a351f] shadow-xs transition-all cursor-pointer active:scale-95"
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
// AddItemDialog
// ---------------------------------------------------------------------------
type ItemKind = 'event' | 'reminder';

interface AddItemForm {
  kind: ItemKind;
  title: string;
  date: string;
  time: string;
  location: string;
  description: string;
  memberId: string;
  recurrence: 'none' | CalendarRecurrence;
  recurrenceUntil: string;
}

function AddCalendarItemDialog({
  open,
  defaultDate,
  members,
  onClose,
  onSave,
  initialValues,
  itemId,
}: {
  open: boolean;
  defaultDate: string;
  members: Member[];
  onClose: () => void;
  onSave: (form: AddItemForm, itemId?: string) => Promise<void>;
  initialValues?: Partial<AddItemForm>;
  itemId?: string;
}) {
  const firstMemberId = members[0]?.id ?? 'everyone';
  const [form, setForm] = useState<AddItemForm>({
    kind: initialValues?.kind ?? 'event',
    title: '',
    date: defaultDate,
    time: '10:00',
    location: '',
    description: '',
    memberId: firstMemberId,
    recurrence: 'none',
    recurrenceUntil: defaultDate,
    ...initialValues,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const now = new Date();
  const todayDateStr = formatDate(now.getFullYear(), now.getMonth(), now.getDate());
  const pastEventDateError = 'Events must be scheduled for today or a future date.';

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date) return;
    if (form.kind === 'event' && !itemId && form.date < todayDateStr) {
      setSaveError(pastEventDateError);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(form, itemId);
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save calendar item.');
    } finally {
      setSaving(false);
    }
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
        aria-labelledby="add-calendar-title"
        className="fixed bottom-0 left-1/2 z-50 max-h-[90dvh] w-full max-w-[480px] -translate-x-1/2 overflow-y-auto rounded-t-2xl bg-card p-6 pb-[max(24px,env(safe-area-inset-bottom))] shadow-lg"
      >
        <h2 id="add-calendar-title" className="font-display text-xl font-extrabold mb-4">
          {itemId ? 'Edit calendar item' : 'Add to family calendar'}
        </h2>
        {saveError && (
          <p role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {saveError}
          </p>
        )}
        {itemId && initialValues?.recurrence && initialValues.recurrence !== 'none' && (
          <p className="mb-4 text-xs text-muted-foreground">
            Changes apply to the entire repeating series.
          </p>
        )}

        {/* Kind Toggle */}
        {!itemId && <div className="segmented mb-4">
          <button
            type="button"
            className={
              form.kind === 'event'
                ? 'py-2 px-3 text-sm font-semibold rounded-md bg-card text-foreground shadow-xs cursor-pointer'
                : 'py-2 px-3 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground cursor-pointer'
            }
            onClick={() => setForm((f) => ({ ...f, kind: 'event' }))}
          >
            Event
          </button>
          <button
            type="button"
            className={
              form.kind === 'reminder'
                ? 'py-2 px-3 text-sm font-semibold rounded-md bg-card text-foreground shadow-xs cursor-pointer'
                : 'py-2 px-3 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground cursor-pointer'
            }
            onClick={() => setForm((f) => ({ ...f, kind: 'reminder' }))}
          >
            Reminder
          </button>
        </div>}

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label className="form-field">
            {form.kind === 'event' ? 'Event title' : 'Reminder title'}
            <input
              required
              autoFocus
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder={
                form.kind === 'event'
                  ? 'e.g. Lola’s check-up, Family dinner'
                  : 'e.g. Pick up prescription, Water plants'
              }
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="form-field">
              Date
              <input
                required
                type="date"
                min={form.kind === 'event' && !itemId ? todayDateStr : undefined}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.date}
                onInvalid={(e) => {
                  if (e.currentTarget.validity.rangeUnderflow) {
                    e.preventDefault();
                    setSaveError(pastEventDateError);
                  }
                }}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </label>
            <label className="form-field">
              Time (optional)
              <input
                type="time"
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              />
            </label>
          </div>

          {form.kind === 'event' && (
            <label className="form-field">
              Location (optional)
              <input
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="e.g. Makati Medical Center, At home"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
            </label>
          )}

          <label className="form-field">
            Repeat
            <select
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
              value={form.recurrence}
              onChange={(e) => {
                const recurrence = e.target.value;
                if (recurrence === 'none' || recurrence === 'daily' || recurrence === 'weekly' || recurrence === 'monthly') {
                  setForm((f) => ({
                    ...f,
                    recurrence,
                    recurrenceUntil: recurrence === 'none' ? f.date : f.recurrenceUntil || f.date,
                  }));
                }
              }}
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Every day</option>
              <option value="weekly">Every week</option>
              <option value="monthly">Every month</option>
            </select>
          </label>
          {form.recurrence !== 'none' && (
            <label className="form-field">
              Repeat until
              <input
                required
                type="date"
                min={form.date}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.recurrenceUntil}
                onChange={(e) => setForm((f) => ({ ...f, recurrenceUntil: e.target.value }))}
              />
            </label>
          )}

          {form.kind === 'event' && (
            <label className="form-field">
              Description (optional)
              <textarea
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-base focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Add notes for your family"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
          )}

          <label className="form-field">
            {form.kind === 'event' ? 'Family member' : 'Assignee'}
            <select
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
              value={form.memberId}
              onChange={(e) => setForm((f) => ({ ...f, memberId: e.target.value }))}
            >
              <option value="everyone">Everyone (All family)</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.roleLabel}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-2 flex gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="h-11 flex-1 rounded-lg border border-input bg-background font-semibold hover:bg-muted transition-colors cursor-pointer disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-11 flex-1 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-60"
            >
              {saving ? 'Saving…' : itemId ? 'Save changes' : form.kind === 'event' ? 'Save event' : 'Save reminder'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// CalendarView
// ---------------------------------------------------------------------------
export function CalendarView({ householdId }: { householdId?: string | null }) {
  const now = new Date();
  const todayDateStr = formatDate(now.getFullYear(), now.getMonth(), now.getDate());
  const [mode, setMode] = useState<'Month' | 'Week' | 'Agenda'>('Month');
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [addOpen, setAddOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<
    { kind: 'event'; item: CalendarEvent } | { kind: 'reminder'; item: Reminder } | null
  >(null);
  const [memberFilter, setMemberFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'event' | 'reminder' | 'birthday'>('all');
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () => typeof Notification !== 'undefined' && Notification.permission === 'granted',
  );

  const events = useLiveQuery(
    () => householdId
      ? db.events.where('householdId').equals(householdId).toArray()
      : db.events.toArray(),
    [householdId],
  ) ?? [];
  const reminders = useLiveQuery(
    () => householdId
      ? db.reminders.where('householdId').equals(householdId).toArray()
      : db.reminders.toArray(),
    [householdId],
  ) ?? [];
  const members = useLiveQuery(
    () => householdId
      ? db.members.where('householdId').equals(householdId).toArray()
      : db.members.toArray(),
    [householdId],
  ) ?? [];

  const activeMembers = members.filter((m) => !m.deleted);
  const memberMap = new Map(activeMembers.map((m) => [m.id, m]));
  const currentMemberId = getCurrentMemberId();
  const effectiveHouseholdId = householdId || activeMembers[0]?.householdId || 'household-1';
  const effectiveMemberId = currentMemberId || activeMembers[0]?.id || 'me';

  const activeEvents = events.filter((e) => !e.deleted);
  const activeReminders = reminders.filter((r) => !r.deleted);
  const visibleEvents = typeFilter === 'all' || typeFilter === 'event'
    ? activeEvents.filter((event) => memberFilter === 'all' || event.memberId === memberFilter)
    : [];
  const visibleReminders = typeFilter === 'all' || typeFilter === 'reminder'
    ? activeReminders.filter((reminder) => memberFilter === 'all' || reminder.assigneeId === memberFilter)
    : [];
  const visibleMembers = typeFilter === 'all' || typeFilter === 'birthday'
    ? activeMembers.filter((member) => memberFilter === 'all' || member.id === memberFilter)
    : [];
  const openAddDialog = () => {
    setActionError(null);
    setEditingItem(null);
    setAddOpen(true);
  };
  const openEditDialog = (item: CalendarEvent | Reminder) => {
    setActionError(null);
    if ('date' in item) setEditingItem({ kind: 'event', item });
    else setEditingItem({ kind: 'reminder', item });
    setAddOpen(true);
  };

  useEffect(() => {
    if (!notificationsEnabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return;
    }

    const checkDueReminders = () => {
      const nowMs = Date.now();
      const today = new Date();
      const todayString = formatDate(today.getFullYear(), today.getMonth(), today.getDate());
      const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      const tomorrowString = formatDate(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());

      for (const reminder of reminders) {
        if (reminder.deleted) continue;
        const dueDates = getRecurrenceDates(
          reminder.dueDate,
          reminder.recurrence,
          reminder.recurrenceUntil,
          todayString,
          tomorrowString,
        );
        for (const date of dueDates) {
          const isDone = reminder.recurrence
            ? reminder.completedDates?.includes(date) ?? false
            : reminder.done;
          if (isDone) continue;
          const dueAt = new Date(`${date}T${reminder.dueTime || '09:00'}`).getTime();
          if (dueAt > nowMs || nowMs - dueAt > 60_000) continue;
          const notificationKey = `kubo-calendar-reminder:${reminder.id}:${date}`;
          if (window.localStorage.getItem(notificationKey)) continue;

          try {
            new Notification(reminder.title, {
              body: `Reminder due${reminder.dueTime ? ` at ${reminder.dueTime}` : ''}.`,
              tag: notificationKey,
            });
            window.localStorage.setItem(notificationKey, 'sent');
          } catch (error) {
            setActionError(error instanceof Error ? error.message : 'Could not show reminder notification.');
          }
        }
      }
    };

    checkDueReminders();
    const intervalId = window.setInterval(checkDueReminders, 15_000);
    return () => window.clearInterval(intervalId);
  }, [notificationsEnabled, reminders]);

  async function enableNotifications() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setActionError('This browser does not support notifications.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setActionError(permission === 'denied'
          ? 'Notifications are blocked in your browser settings.'
          : 'Notification permission was not granted.');
        return;
      }
      setNotificationsEnabled(true);
      setActionError(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not enable notifications.');
    }
  }

  function runAction(action: () => Promise<void>) {
    setActionError(null);
    void action().catch((error: unknown) => {
      setActionError(error instanceof Error ? error.message : 'Could not update calendar item.');
    });
  }

  // Calendar calculations
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Navigation handlers
  function handlePrevMonth() {
    changeMonth(-1);
  }

  function handleNextMonth() {
    changeMonth(1);
  }

  function changeMonth(offset: number) {
    const nextMonth = new Date(currentYear, currentMonth + offset, 1);
    setCurrentYear(nextMonth.getFullYear());
    setCurrentMonth(nextMonth.getMonth());
    setSelectedDay((day) =>
      Math.min(day, new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate()),
    );
  }

  function changeWeek(offset: number) {
    selectDate(new Date(currentYear, currentMonth, selectedDay + offset * 7));
  }

  function selectDate(date: Date) {
    setCurrentYear(date.getFullYear());
    setCurrentMonth(date.getMonth());
    setSelectedDay(date.getDate());
  }

  // Selected date formatted as YYYY-MM-DD
  const selectedDateStr = formatDate(currentYear, currentMonth, selectedDay);

  // Find items for a specific day in the current view
  function getItemsForDay(year: number, month: number, day: number) {
    const dateStr = formatDate(year, month, day);
    const dayEvents: CalendarEventOccurrence[] = visibleEvents.flatMap((event) =>
      getRecurrenceDates(event.date, event.recurrence, event.recurrenceUntil, dateStr, dateStr)
        .map((occurrenceDate) => ({ ...event, occurrenceDate })),
    );
    const dayReminders: ReminderOccurrence[] = visibleReminders.flatMap((reminder) =>
      getRecurrenceDates(reminder.dueDate, reminder.recurrence, reminder.recurrenceUntil, dateStr, dateStr)
        .map((occurrenceDate) => ({
          ...reminder,
          occurrenceDate,
          occurrenceDone: reminder.recurrence
            ? reminder.completedDates?.includes(occurrenceDate) ?? false
            : reminder.done,
        })),
    );
    const birthdays = visibleMembers.filter((m) => {
      const b = parseBirthday(m.birthday);
      return b && b.month === month && b.day === day;
    });

    return { dayEvents, dayReminders, birthdays };
  }

  // Check if a calendar day has any items
  function dayHasItems(day: number): boolean {
    const { dayEvents, dayReminders, birthdays } = getItemsForDay(currentYear, currentMonth, day);
    return dayEvents.length > 0 || dayReminders.length > 0 || birthdays.length > 0;
  }

  // Handlers
  async function enqueueCalendarSync(table: 'events' | 'reminders', op: 'create' | 'update' | 'delete') {
    await db.syncQueue.add({
      id: crypto.randomUUID(),
      table,
      op,
      createdAt: new Date().toISOString(),
    });
  }

  async function handleToggleReminder(id: string, occurrenceDate: string, currentDone: boolean) {
    const reminder = await db.reminders.get(id);
    if (!reminder || reminder.deleted) {
      throw new Error('This reminder could not be found. Refresh and try again.');
    }
    const isRecurring = Boolean(reminder.recurrence);
    const completedDates = new Set(reminder.completedDates ?? []);
    if (isRecurring) {
      if (currentDone) completedDates.delete(occurrenceDate);
      else completedDates.add(occurrenceDate);
    }
    const updated = await db.reminders.update(id, {
      done: isRecurring ? reminder.done : !currentDone,
      completedDates: isRecurring ? [...completedDates].sort() : reminder.completedDates,
      updatedAt: new Date().toISOString(),
      updatedBy: effectiveMemberId,
    });
    if (!updated) throw new Error('This reminder could not be found. Refresh and try again.');
    await enqueueCalendarSync('reminders', 'update');
  }

  async function handleDeleteEvent(id: string) {
    const event = await db.events.get(id);
    if (!event || event.deleted) {
      throw new Error('This event could not be found. Refresh and try again.');
    }
    const updated = await db.events.update(id, {
      deleted: true,
      updatedAt: new Date().toISOString(),
      updatedBy: effectiveMemberId,
    });
    if (!updated) throw new Error('This event could not be found. Refresh and try again.');
    await enqueueCalendarSync('events', 'delete');
  }

  async function handleDeleteReminder(id: string) {
    const reminder = await db.reminders.get(id);
    if (!reminder || reminder.deleted) {
      throw new Error('This reminder could not be found. Refresh and try again.');
    }
    const updated = await db.reminders.update(id, {
      deleted: true,
      updatedAt: new Date().toISOString(),
      updatedBy: effectiveMemberId,
    });
    if (!updated) throw new Error('This reminder could not be found. Refresh and try again.');
    await enqueueCalendarSync('reminders', 'delete');
  }

  async function handleAddItem(form: AddItemForm, itemId?: string) {
    if (form.recurrence !== 'none' && (!form.recurrenceUntil || form.recurrenceUntil < form.date)) {
      throw new Error('Choose a repeat end date on or after the start date.');
    }
    if (form.kind === 'event' && !itemId && form.date < todayDateStr) {
      throw new Error('Events must be scheduled for today or a future date.');
    }

    const timeNow = new Date().toISOString();
    if (form.kind === 'event') {
      const member = activeMembers.find((m) => m.id === form.memberId);
      const existing = itemId ? await db.events.get(itemId) : undefined;
      if (itemId && (!existing || existing.deleted)) {
        throw new Error('This event could not be found. Refresh and try again.');
      }
      const newEvent: CalendarEvent = {
        ...existing,
        id: itemId ?? crypto.randomUUID(),
        householdId: existing?.householdId ?? effectiveHouseholdId,
        title: form.title.trim(),
        date: form.date,
        time: form.time || undefined,
        location: form.location.trim() || undefined,
        description: form.description.trim() || undefined,
        createdBy: existing?.createdBy ?? effectiveMemberId,
        memberId: form.memberId === 'everyone' ? undefined : form.memberId,
        color: member?.color ?? '#E0F2FE',
        recurrence: form.recurrence === 'none' ? undefined : form.recurrence,
        recurrenceUntil: form.recurrence === 'none' ? undefined : form.recurrenceUntil,
        updatedAt: timeNow,
        updatedBy: effectiveMemberId,
        deleted: false,
      };
      if (itemId) await db.events.put(newEvent);
      else await db.events.add(newEvent);
      await enqueueCalendarSync('events', itemId ? 'update' : 'create');
    } else {
      const existing = itemId ? await db.reminders.get(itemId) : undefined;
      if (itemId && (!existing || existing.deleted)) {
        throw new Error('This reminder could not be found. Refresh and try again.');
      }
      const newReminder: Reminder = {
        ...existing,
        id: itemId ?? crypto.randomUUID(),
        householdId: existing?.householdId ?? effectiveHouseholdId,
        title: form.title.trim(),
        dueDate: form.date,
        dueTime: form.time || undefined,
        done: existing?.done ?? false,
        createdBy: existing?.createdBy ?? effectiveMemberId,
        assigneeId: form.memberId === 'everyone' ? undefined : form.memberId,
        recurrence: form.recurrence === 'none' ? undefined : form.recurrence,
        recurrenceUntil: form.recurrence === 'none' ? undefined : form.recurrenceUntil,
        updatedAt: timeNow,
        updatedBy: effectiveMemberId,
        deleted: false,
      };
      if (itemId) await db.reminders.put(newReminder);
      else await db.reminders.add(newReminder);
      await enqueueCalendarSync('reminders', itemId ? 'update' : 'create');
    }
  }

  // Items for currently selected day
  const {
    dayEvents: selectedDayEvents,
    dayReminders: selectedDayReminders,
    birthdays: selectedDayBirthdays,
  } = getItemsForDay(currentYear, currentMonth, selectedDay);

  const selectedDayTotalItems =
    selectedDayEvents.length + selectedDayReminders.length + selectedDayBirthdays.length;

  // Agenda view list: all upcoming items sorted by date
  interface AgendaItem {
    id: string;
    type: 'event' | 'reminder' | 'birthday';
    title: string;
    date: string;
    time?: string;
    location?: string;
    description?: string;
    recurrence?: CalendarRecurrence;
    memberLabel: string;
    memberColor?: string;
    done?: boolean;
    rawId?: string;
  }

  const agendaEndDate = formatDate(now.getFullYear() + 1, now.getMonth(), now.getDate());
  const agendaItems: AgendaItem[] = [
    ...visibleEvents.flatMap((e) => getRecurrenceDates(e.date, e.recurrence, e.recurrenceUntil, todayDateStr, agendaEndDate).map((occurrenceDate) => {
      const member = e.memberId ? memberMap.get(e.memberId) : undefined;
      return {
        id: `event-${e.id}-${occurrenceDate}`,
        rawId: e.id,
        type: 'event' as const,
        title: e.title,
        date: occurrenceDate,
        time: e.time,
        location: e.location,
        description: e.description,
        recurrence: e.recurrence,
        memberLabel: member ? member.name : 'Everyone',
        memberColor: member?.color,
      };
    })),
    ...visibleReminders.flatMap((r) => getRecurrenceDates(r.dueDate, r.recurrence, r.recurrenceUntil, todayDateStr, agendaEndDate).map((occurrenceDate) => {
      const assignee = r.assigneeId ? memberMap.get(r.assigneeId) : undefined;
      const done = r.recurrence ? r.completedDates?.includes(occurrenceDate) ?? false : r.done;
      return {
        id: `reminder-${r.id}-${occurrenceDate}`,
        rawId: r.id,
        type: 'reminder' as const,
        title: r.title,
        date: occurrenceDate,
        time: r.dueTime,
        recurrence: r.recurrence,
        memberLabel: assignee ? assignee.name : 'Everyone',
        memberColor: assignee?.color,
        done,
      };
    })),
    ...visibleMembers.flatMap((m) => {
      const b = parseBirthday(m.birthday);
      if (!b) return [];
      return [now.getFullYear(), now.getFullYear() + 1]
        .map((year) => formatDate(year, b.month, b.day))
        .filter((date) => date >= todayDateStr && date <= agendaEndDate)
        .map((dateStr) => (
        {
          id: `bday-${m.id}-${dateStr}`,
          type: 'birthday' as const,
          title: `🎂 ${m.name}’s Birthday`,
          memberLabel: m.roleLabel,
          memberColor: m.color,
          date: dateStr,
        }
      ));
    }),
  ]
    .sort((a, b) =>
      a.date.localeCompare(b.date) ||
      ('time' in a ? a.time ?? '' : '').localeCompare('time' in b ? b.time ?? '' : ''),
    );
  const weekStart = new Date(currentYear, currentMonth, selectedDay);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });
  const editingInitialValues: Partial<AddItemForm> | undefined = editingItem
    ? editingItem.kind === 'event'
      ? {
          kind: 'event',
          title: editingItem.item.title,
          date: editingItem.item.date,
          time: editingItem.item.time ?? '',
          location: editingItem.item.location ?? '',
          description: editingItem.item.description ?? '',
          memberId: editingItem.item.memberId ?? 'everyone',
          recurrence: editingItem.item.recurrence ?? 'none',
          recurrenceUntil: editingItem.item.recurrenceUntil ?? editingItem.item.date,
        }
      : {
          kind: 'reminder',
          title: editingItem.item.title,
          date: editingItem.item.dueDate,
          time: editingItem.item.dueTime ?? '',
          location: '',
          description: '',
          memberId: editingItem.item.assigneeId ?? 'everyone',
          recurrence: editingItem.item.recurrence ?? 'none',
          recurrenceUntil: editingItem.item.recurrenceUntil ?? editingItem.item.dueDate,
        }
    : undefined;

  return (
    <>
      <PageHeading
        title="Family calendar"
        subtitle="Make time for what matters."
        onAdd={householdId ? openAddDialog : undefined}
      />
      {actionError && (
        <div role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
          <button
            type="button"
            className="ml-2 font-semibold underline cursor-pointer"
            onClick={() => setActionError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Segmented View Mode */}
      <div className="segmented">
        <button
          type="button"
          data-active={mode === 'Month'}
          onClick={() => setMode('Month')}
        >
          Month
        </button>
        <button
          type="button"
          data-active={mode === 'Week'}
          onClick={() => setMode('Week')}
        >
          Week
        </button>
        <button
          type="button"
          data-active={mode === 'Agenda'}
          onClick={() => setMode('Agenda')}
        >
          Agenda
        </button>
      </div>

      <div className="mb-3 grid grid-cols-[1fr_1fr_auto] gap-2">
        <label className="sr-only" htmlFor="calendar-member-filter">Filter by family member</label>
        <select
          id="calendar-member-filter"
          className="h-10 min-w-0 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground shadow-xs hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          value={memberFilter}
          onChange={(event) => setMemberFilter(event.target.value)}
        >
          <option value="all">All members</option>
          {activeMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select>
        <label className="sr-only" htmlFor="calendar-type-filter">Filter by calendar item type</label>
        <select
          id="calendar-type-filter"
          className="h-10 min-w-0 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground shadow-xs hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          value={typeFilter}
          onChange={(event) => {
            const value = event.target.value;
            if (value === 'all' || value === 'event' || value === 'reminder' || value === 'birthday') {
              setTypeFilter(value);
            }
          }}
        >
          <option value="all">All types</option>
          <option value="event">Events</option>
          <option value="reminder">Reminders</option>
          <option value="birthday">Birthdays</option>
        </select>
        <button
          type="button"
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold shadow-xs transition-colors cursor-pointer ${
            notificationsEnabled
              ? 'border-primary/40 bg-secondary text-primary'
              : 'border-border bg-card text-foreground hover:bg-muted'
          } disabled:opacity-50`}
          disabled={typeof Notification === 'undefined' || notificationsEnabled}
          onClick={() => void enableNotifications()}
          title={notificationsEnabled ? 'Reminder notifications are enabled' : 'Enable browser reminder notifications'}
        >
          {notificationsEnabled ? <BellRing className="size-3.5" /> : <Bell className="size-3.5" />}
          <span>{notificationsEnabled ? 'On' : 'Notify'}</span>
        </button>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        {notificationsEnabled
          ? 'Browser reminders are enabled while this page is open.'
          : 'Filters apply to every calendar view.'}
      </p>

      {mode !== 'Agenda' ? (
        <>
          {/* Month or week header */}
          <div className="flex justify-between items-center mb-4 px-1">
            <button
              type="button"
              className="p-2 rounded-lg text-foreground/80 hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
              aria-label="Previous month"
              onClick={() => mode === 'Month' ? handlePrevMonth() : changeWeek(-1)}
            >
              <ChevronLeft className="size-5" />
            </button>
            <h2 className="font-bold text-base">
              {mode === 'Month'
                ? `${MONTH_NAMES[currentMonth]} ${currentYear}`
                : `${weekDates[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekDates[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
            </h2>
            <button
              type="button"
              className="p-2 rounded-lg text-foreground/80 hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
              aria-label="Next month"
              onClick={() => mode === 'Month' ? handleNextMonth() : changeWeek(1)}
            >
              <ChevronRight className="size-5" />
            </button>
          </div>

          {mode === 'Month' ? (
            <div className="calendar-grid mb-6">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayName, idx) => (
                <span key={idx} className="text-xs font-semibold text-muted-foreground h-7 flex items-center justify-center">
                  {dayName}
                </span>
              ))}
              {Array.from({ length: firstDayOfMonth }, (_, i) => (
                <span key={`blank-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const isSelected = selectedDay === day;
                const hasItems = dayHasItems(day);
                return (
                  <button
                    key={day}
                    type="button"
                    className={`calendar-day cursor-pointer border-0 ${isSelected ? 'selected' : ''} ${hasItems ? 'has-event' : ''}`}
                    onClick={() => setSelectedDay(day)}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="week-grid mb-6" role="group" aria-label="Week view">
              {weekDates.map((date) => {
                const dateString = formatDate(date.getFullYear(), date.getMonth(), date.getDate());
                const isSelected = date.getDate() === selectedDay
                  && date.getMonth() === currentMonth
                  && date.getFullYear() === currentYear;
                const hasItems = getItemsForDay(date.getFullYear(), date.getMonth(), date.getDate());
                return (
                  <button
                    key={dateString}
                    type="button"
                    className={`week-day ${isSelected ? 'selected' : ''}`}
                    onClick={() => selectDate(date)}
                  >
                    <span>{date.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                    <strong>{date.getDate()}</strong>
                    <small>{hasItems.dayEvents.length + hasItems.dayReminders.length + hasItems.birthdays.length || ''}</small>
                  </button>
                );
              })}
            </div>
          )}

          {/* Selected Date Header */}
          <div className="section-title">
            <h2>
              {MONTH_NAMES[currentMonth]} {selectedDay}, {currentYear}
            </h2>
            <span className="text-xs text-muted-foreground font-medium">
              {selectedDayTotalItems === 0
                ? 'Free day'
                : `${selectedDayTotalItems} ${selectedDayTotalItems === 1 ? 'item' : 'items'}`}
            </span>
          </div>

          {/* Selected Date Items */}
          {selectedDayTotalItems === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <CalendarDays className="mx-auto mb-3 size-8 text-muted-foreground/70" />
              <p className="text-sm font-medium">A little breathing room.</p>
              <p className="text-xs mt-1 text-muted-foreground/80">No family events scheduled for this day.</p>
              {householdId && (
                <button
                  className="mt-3 text-sm font-semibold text-primary underline-offset-4 hover:underline cursor-pointer"
                  onClick={openAddDialog}
                >
                  Add an event
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {/* Birthdays */}
              {selectedDayBirthdays.map((m) => (
                <div className="event-row" key={`bday-${m.id}`}>
                  <div className="date-tile bg-peach text-peach-ink">
                    <Cake className="size-4" />
                    <strong>{selectedDay}</strong>
                  </div>
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-1.5 font-bold">
                      🎂 {m.name}’s Birthday
                    </h3>
                    <p className="text-xs text-muted-foreground">Family celebration</p>
                  </div>
                  <span className="pill-label bg-peach text-peach-ink">{m.roleLabel}</span>
                </div>
              ))}

              {/* Events */}
              {selectedDayEvents.map((event) => {
                const member = event.memberId ? memberMap.get(event.memberId) : undefined;
                return (
                  <div className="event-row" key={event.id}>
                    <div className="date-tile">
                      <span>{MONTH_SHORT[currentMonth]}</span>
                      <strong>{selectedDay}</strong>
                    </div>
                    <div className="min-w-0 pr-2">
                      <h3 className="font-semibold">{event.title}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
                        {event.time && (
                          <span className="inline-flex items-center gap-0.5">
                            <Clock className="size-3" />
                            {event.time}
                          </span>
                        )}
                        {event.location && (
                          <span className="inline-flex items-center gap-0.5">
                            <MapPin className="size-3" />
                            {event.location}
                          </span>
                        )}
                        <span>· {member ? member.name : 'Everyone'}</span>
                      </p>
                      {event.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{event.description}</p>
                      )}
                      {event.recurrence && (
                        <p className="mt-1 text-xs text-primary">Repeats {event.recurrence} until {event.recurrenceUntil}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="pill-label bg-secondary text-primary">
                        {member ? member.name : 'All'}
                      </span>
                      <button
                        type="button"
                        className="p-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                        aria-label={`Edit ${event.title}`}
                        onClick={() => openEditDialog(event)}
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        className="p-1 text-muted-foreground/40 hover:text-destructive transition-colors cursor-pointer"
                        aria-label={event.recurrence
                          ? `Delete ${event.title} and all repeats`
                          : `Delete ${event.title}`}
                        onClick={() => runAction(() => handleDeleteEvent(event.id))}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Reminders */}
              {selectedDayReminders.map((reminder) => {
                const assignee = reminder.assigneeId
                  ? memberMap.get(reminder.assigneeId)
                  : undefined;
                const reminderStatus = getReminderStatus(
                  reminder.occurrenceDate,
                  reminder.dueTime,
                  reminder.occurrenceDone,
                );
                return (
                  <div className="event-row" key={reminder.id}>
                    <button
                      type="button"
                      className="p-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                      aria-label={reminder.occurrenceDone ? `Mark ${reminder.title} not done` : `Mark ${reminder.title} done`}
                      onClick={() => runAction(() => handleToggleReminder(reminder.id, reminder.occurrenceDate, reminder.occurrenceDone))}
                    >
                      {reminder.occurrenceDone ? (
                        <CheckCircle2 className="size-6 text-primary" />
                      ) : (
                        <Circle className="size-6 text-muted-foreground" />
                      )}
                    </button>
                    <div className="min-w-0 pr-2">
                      <h3 className={reminder.occurrenceDone ? 'line-through text-muted-foreground font-normal' : 'font-semibold'}>
                        {reminder.title}
                      </h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Bell className="size-3" />
                        {reminder.dueTime ? `Due ${reminder.dueTime} · ` : 'Reminder · '}
                        {assignee ? assignee.name : 'Everyone'}
                      </p>
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        reminderStatus === 'Overdue' ? 'bg-destructive/10 text-destructive'
                          : reminderStatus === 'Due soon' ? 'bg-peach text-peach-ink'
                            : reminderStatus === 'Done' ? 'bg-secondary text-primary'
                              : 'bg-muted text-muted-foreground'
                      }`}>{reminderStatus}</span>
                      {reminder.recurrence && (
                        <p className="mt-1 text-xs text-primary">Repeats {reminder.recurrence} until {reminder.recurrenceUntil}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="p-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                        aria-label={`Edit ${reminder.title}`}
                        onClick={() => openEditDialog(reminder)}
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        className="p-1 text-muted-foreground/40 hover:text-destructive transition-colors cursor-pointer"
                        aria-label={reminder.recurrence
                          ? `Delete ${reminder.title} and all repeats`
                          : `Delete ${reminder.title}`}
                        onClick={() => runAction(() => handleDeleteReminder(reminder.id))}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Agenda View */
        <>
          <div className="section-title">
            <h2>Upcoming together</h2>
            <span className="text-xs text-muted-foreground">Chronological list</span>
          </div>

          {agendaItems.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <CalendarDays className="mx-auto mb-3 size-8 text-muted-foreground/70" />
              <p className="text-sm font-medium">Your agenda is clear.</p>
              <p className="text-xs mt-1 text-muted-foreground/80">Add family moments, appointments, and tasks.</p>
              <button
                className="mt-3 text-sm font-semibold text-primary underline-offset-4 hover:underline cursor-pointer"
                onClick={openAddDialog}
              >
                Add to calendar
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {agendaItems.map((item) => {
                const dateParts = item.date.split('-');
                const monthIdx = parseInt(dateParts[1], 10) - 1;
                const dayNum = parseInt(dateParts[2], 10);

                return (
                  <div className="event-row" key={item.id}>
                    <div className="date-tile">
                      <span>{MONTH_SHORT[monthIdx] || 'DATE'}</span>
                      <strong>{dayNum || '—'}</strong>
                    </div>
                    <div className="min-w-0 pr-2">
                      <h3 className={item.done ? 'line-through text-muted-foreground font-normal' : 'font-semibold'}>
                        {item.title}
                      </h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
                        {item.time && (
                          <span className="inline-flex items-center gap-0.5">
                            <Clock className="size-3" />
                            {item.time}
                          </span>
                        )}
                        {item.location && (
                          <span className="inline-flex items-center gap-0.5">
                            <MapPin className="size-3" />
                            {item.location}
                          </span>
                        )}
                        <span>· {item.memberLabel}</span>
                      </p>
                      {item.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                      )}
                      {item.type === 'reminder' && (
                        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          getReminderStatus(item.date, item.time, item.done ?? false) === 'Overdue'
                            ? 'bg-destructive/10 text-destructive'
                            : getReminderStatus(item.date, item.time, item.done ?? false) === 'Due soon'
                              ? 'bg-peach text-peach-ink'
                              : item.done ? 'bg-secondary text-primary' : 'bg-muted text-muted-foreground'
                        }`}>
                          {getReminderStatus(item.date, item.time, item.done ?? false)}
                        </span>
                      )}
                      {item.type !== 'birthday' && 'recurrence' in item && item.recurrence && (
                        <p className="mt-1 text-xs text-primary">Repeats {item.recurrence}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="pill-label bg-secondary text-primary">
                        {item.memberLabel}
                      </span>
                      {item.rawId && (
                        <>
                          <button
                            type="button"
                            className="p-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                            aria-label={`Edit ${item.title}`}
                            onClick={() => {
                              const source = item.type === 'event'
                                ? activeEvents.find((event) => event.id === item.rawId)
                                : activeReminders.find((reminder) => reminder.id === item.rawId);
                              if (source) openEditDialog(source);
                            }}
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            className="p-1 text-muted-foreground/40 hover:text-destructive transition-colors cursor-pointer"
                            aria-label={item.recurrence
                              ? `Delete ${item.title} and all repeats`
                              : `Delete ${item.title}`}
                            onClick={() => runAction(() => (
                              item.type === 'event'
                                ? handleDeleteEvent(item.rawId!)
                                : handleDeleteReminder(item.rawId!)
                            ))}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Add Dialog */}
      <AddCalendarItemDialog
        key={`${selectedDateStr}-${addOpen}-${editingItem?.item.id ?? 'new'}`}
        open={addOpen}
        defaultDate={selectedDateStr}
        members={activeMembers}
        onClose={() => {
          setAddOpen(false);
          setEditingItem(null);
        }}
        onSave={handleAddItem}
        initialValues={editingInitialValues}
        itemId={editingItem?.item.id}
      />
    </>
  );
}
