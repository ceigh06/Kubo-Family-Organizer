import { useState } from 'react';
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
  Users,
} from 'lucide-react';
import { db } from '@/db';
import type { CalendarEvent, Reminder, Member } from '@/db/schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

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
// AddItemDialog
// ---------------------------------------------------------------------------
type ItemKind = 'event' | 'reminder';

interface AddItemForm {
  kind: ItemKind;
  title: string;
  date: string;
  time: string;
  location: string;
  memberId: string;
}

function AddCalendarItemDialog({
  open,
  defaultDate,
  members,
  onClose,
  onSave,
}: {
  open: boolean;
  defaultDate: string;
  members: Member[];
  onClose: () => void;
  onSave: (form: AddItemForm) => void;
}) {
  const [form, setForm] = useState<AddItemForm>({
    kind: 'event',
    title: '',
    date: defaultDate,
    time: '10:00',
    location: '',
    memberId: members[0]?.id ?? 'everyone',
  });

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date) return;
    onSave(form);
    setForm({
      kind: 'event',
      title: '',
      date: defaultDate,
      time: '10:00',
      location: '',
      memberId: members[0]?.id ?? 'everyone',
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
        aria-labelledby="add-calendar-title"
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 rounded-t-2xl bg-card p-6 pb-[max(24px,env(safe-area-inset-bottom))] shadow-lg"
      >
        <h2 id="add-calendar-title" className="font-display text-xl font-extrabold mb-4">
          Add to family calendar
        </h2>

        {/* Kind Toggle */}
        <div className="segmented mb-4">
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
        </div>

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
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.date}
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
            {form.kind === 'event' ? 'Family member' : 'Assignee'}
            <select
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
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

          <button
            type="submit"
            className="h-11 w-full rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors cursor-pointer mt-2"
          >
            {form.kind === 'event' ? 'Save event' : 'Save reminder'}
          </button>
        </form>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// CalendarView
// ---------------------------------------------------------------------------
export function CalendarView() {
  const now = new Date();
  const [mode, setMode] = useState<'Month' | 'Agenda'>('Month');
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [addOpen, setAddOpen] = useState(false);

  // Live queries directly from Dexie
  const events = useLiveQuery(() => db.events.toArray(), []) ?? [];
  const reminders = useLiveQuery(() => db.reminders.toArray(), []) ?? [];
  const members = useLiveQuery(() => db.members.toArray(), []) ?? [];

  const activeMembers = members.filter((m) => !m.deleted);
  const memberMap = new Map(activeMembers.map((m) => [m.id, m]));

  const activeEvents = events.filter((e) => !e.deleted);
  const activeReminders = reminders.filter((r) => !r.deleted);

  // Calendar calculations
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Navigation handlers
  function handlePrevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function handleNextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  // Selected date formatted as YYYY-MM-DD
  const selectedDateStr = `${currentYear}-${padZero(currentMonth + 1)}-${padZero(selectedDay)}`;

  // Find items for a specific day in the current view
  function getItemsForDay(year: number, month: number, day: number) {
    const dateStr = `${year}-${padZero(month + 1)}-${padZero(day)}`;
    const dayEvents = activeEvents.filter((e) => e.date === dateStr);
    const dayReminders = activeReminders.filter((r) => r.dueDate === dateStr);
    const birthdays = activeMembers.filter((m) => {
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
  async function handleToggleReminder(id: string, currentDone: boolean) {
    await db.reminders.update(id, {
      done: !currentDone,
      updatedAt: new Date().toISOString(),
    });
  }

  async function handleDeleteEvent(id: string) {
    await db.events.update(id, {
      deleted: true,
      updatedAt: new Date().toISOString(),
    });
  }

  async function handleDeleteReminder(id: string) {
    await db.reminders.update(id, {
      deleted: true,
      updatedAt: new Date().toISOString(),
    });
  }

  async function handleAddItem(form: AddItemForm) {
    const timeNow = new Date().toISOString();
    if (form.kind === 'event') {
      const member = activeMembers.find((m) => m.id === form.memberId);
      const newEvent: CalendarEvent = {
        id: generateId(),
        householdId: 'household-1',
        title: form.title.trim(),
        date: form.date,
        time: form.time || undefined,
        location: form.location.trim() || undefined,
        createdBy: 'me',
        memberId: form.memberId === 'everyone' ? undefined : form.memberId,
        color: member?.color ?? '#E0F2FE',
        updatedAt: timeNow,
        updatedBy: 'me',
        deleted: false,
      };
      await db.events.add(newEvent);
    } else {
      const newReminder: Reminder = {
        id: generateId(),
        householdId: 'household-1',
        title: form.title.trim(),
        dueDate: form.date,
        dueTime: form.time || undefined,
        done: false,
        createdBy: 'me',
        assigneeId: form.memberId === 'everyone' ? undefined : form.memberId,
        updatedAt: timeNow,
        updatedBy: 'me',
        deleted: false,
      };
      await db.reminders.add(newReminder);
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
    memberLabel: string;
    memberColor?: string;
    done?: boolean;
    rawId?: string;
  }

  const agendaItems: AgendaItem[] = [
    ...activeEvents.map((e) => {
      const member = e.memberId ? memberMap.get(e.memberId) : undefined;
      return {
        id: `event-${e.id}`,
        rawId: e.id,
        type: 'event' as const,
        title: e.title,
        date: e.date,
        time: e.time,
        location: e.location,
        memberLabel: member ? member.name : 'Everyone',
        memberColor: member?.color,
      };
    }),
    ...activeReminders.map((r) => {
      const assignee = r.assigneeId ? memberMap.get(r.assigneeId) : undefined;
      return {
        id: `reminder-${r.id}`,
        rawId: r.id,
        type: 'reminder' as const,
        title: r.title,
        date: r.dueDate,
        time: r.dueTime,
        memberLabel: assignee ? assignee.name : 'Everyone',
        memberColor: assignee?.color,
        done: r.done,
      };
    }),
    ...activeMembers.flatMap((m) => {
      const b = parseBirthday(m.birthday);
      if (!b) return [];
      const dateStr = `${currentYear}-${padZero(b.month + 1)}-${padZero(b.day)}`;
      return [
        {
          id: `bday-${m.id}`,
          type: 'birthday' as const,
          title: `🎂 ${m.name}’s Birthday`,
          date: dateStr,
          memberLabel: m.roleLabel,
          memberColor: m.color,
        },
      ];
    }),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <PageHeading
        title="Family calendar"
        subtitle="Make time for what matters."
        onAdd={() => setAddOpen(true)}
      />

      {/* Segmented View Mode */}
      <div className="segmented">
        <button
          type="button"
          className={
            mode === 'Month'
              ? 'py-2 px-3 text-sm font-semibold rounded-md bg-card text-foreground shadow-xs cursor-pointer'
              : 'py-2 px-3 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground cursor-pointer'
          }
          onClick={() => setMode('Month')}
        >
          Month
        </button>
        <button
          type="button"
          className={
            mode === 'Agenda'
              ? 'py-2 px-3 text-sm font-semibold rounded-md bg-card text-foreground shadow-xs cursor-pointer'
              : 'py-2 px-3 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground cursor-pointer'
          }
          onClick={() => setMode('Agenda')}
        >
          Agenda
        </button>
      </div>

      {mode === 'Month' ? (
        <>
          {/* Month Header */}
          <div className="flex justify-between items-center mb-4 px-1">
            <button
              type="button"
              className="p-2 rounded-lg text-foreground/80 hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
              aria-label="Previous month"
              onClick={handlePrevMonth}
            >
              <ChevronLeft className="size-5" />
            </button>
            <h2 className="font-bold text-base">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h2>
            <button
              type="button"
              className="p-2 rounded-lg text-foreground/80 hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
              aria-label="Next month"
              onClick={handleNextMonth}
            >
              <ChevronRight className="size-5" />
            </button>
          </div>

          {/* Calendar Grid */}
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
              <button
                className="mt-3 text-sm font-semibold text-primary underline-offset-4 hover:underline cursor-pointer"
                onClick={() => setAddOpen(true)}
              >
                Add an event
              </button>
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
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="pill-label bg-secondary text-primary">
                        {member ? member.name : 'All'}
                      </span>
                      <button
                        type="button"
                        className="p-1 text-muted-foreground/40 hover:text-destructive transition-colors cursor-pointer"
                        aria-label={`Delete ${event.title}`}
                        onClick={() => handleDeleteEvent(event.id)}
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
                return (
                  <div className="event-row" key={reminder.id}>
                    <button
                      type="button"
                      className="p-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                      aria-label={reminder.done ? `Mark ${reminder.title} not done` : `Mark ${reminder.title} done`}
                      onClick={() => handleToggleReminder(reminder.id, reminder.done)}
                    >
                      {reminder.done ? (
                        <CheckCircle2 className="size-6 text-primary" />
                      ) : (
                        <Circle className="size-6 text-muted-foreground" />
                      )}
                    </button>
                    <div className="min-w-0 pr-2">
                      <h3 className={reminder.done ? 'line-through text-muted-foreground font-normal' : 'font-semibold'}>
                        {reminder.title}
                      </h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Bell className="size-3" />
                        {reminder.dueTime ? `Due ${reminder.dueTime} · ` : 'Reminder · '}
                        {assignee ? assignee.name : 'Everyone'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="p-1 text-muted-foreground/40 hover:text-destructive transition-colors cursor-pointer"
                      aria-label={`Delete ${reminder.title}`}
                      onClick={() => handleDeleteReminder(reminder.id)}
                    >
                      <Trash2 className="size-4" />
                    </button>
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
                onClick={() => setAddOpen(true)}
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
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="pill-label bg-secondary text-primary">
                        {item.memberLabel}
                      </span>
                      {item.rawId && (
                        <button
                          type="button"
                          className="p-1 text-muted-foreground/40 hover:text-destructive transition-colors cursor-pointer"
                          aria-label={`Delete ${item.title}`}
                          onClick={() => {
                            if (item.type === 'event') handleDeleteEvent(item.rawId!);
                            else if (item.type === 'reminder') handleDeleteReminder(item.rawId!);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </button>
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
        open={addOpen}
        defaultDate={selectedDateStr}
        members={activeMembers}
        onClose={() => setAddOpen(false)}
        onSave={handleAddItem}
      />
    </>
  );
}
