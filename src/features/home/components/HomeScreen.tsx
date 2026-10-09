import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CalendarDays,
  ShoppingBasket,
  Wallet,
  Pill,
  Sparkles,
  ChevronRight,
  ArrowUpRight,
  ShieldCheck,
  Clock3,
  Check,
  CheckCircle2,
  MoreHorizontal,
  Plus,
  Users,
} from 'lucide-react';
import { db } from '@/db';
import type { Member, Medicine, CalendarEvent, Bill, GroceryItem, Debt, DoseLog } from '@/db/schema';
import { getCurrentMemberId } from '@/features/household/currentMember';
import {
  todaysDoses,
  nextEvent,
  billsDueSoon,
  groceryCount,
  debtSummaryLines,
  formatPesoFromCentavos,
  type DoseWithStatus,
} from '../homeLogic';

interface HomeScreenProps {
  onNavigate?: (tab: 'home' | 'meds' | 'calendar' | 'lists' | 'debts' | 'household') => void;
  onOpenMember?: (member: Member) => void;
  onMagicAdd?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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

function formatEventDate(dateStr: string): { month: string; day: string } {
  const parts = dateStr.split('-');
  const monthShort = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  if (parts.length === 3) {
    const mIdx = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return {
      month: monthShort[mIdx] || 'OCT',
      day: d.toString(),
    };
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return {
      month: monthShort[d.getMonth()] || 'OCT',
      day: d.getDate().toString(),
    };
  }
  return { month: 'OCT', day: '1' };
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function SectionTitle({
  title,
  onAction,
  actionLabel = 'View all',
}: {
  title: string;
  onAction?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="text-primary text-[12px] font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
        >
          {actionLabel}
          <ChevronRight className="size-3" />
        </button>
      )}
    </div>
  );
}

function MemberAvatar({
  member,
  sizeClass = '',
}: {
  member: Member;
  sizeClass?: string;
}) {
  const initial = member.name.charAt(0).toUpperCase() || 'M';
  return (
    <span
      className={`member-avatar ${sizeClass}`}
      style={{ background: member.color || 'var(--secondary)' }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

function HomeDoseCard({
  doseItem,
  member,
  onDoseAction,
}: {
  doseItem: DoseWithStatus;
  member?: Member;
  onDoseAction: (dose: DoseWithStatus, action: 'taken' | 'snooze' | 'skipped' | 'undo') => void;
}) {
  const { medicine, scheduledTime, status } = doseItem;
  const memberName = member?.name ?? 'Family';

  return (
    <article className="dose-card">
      <div className="dose-header">
        <span
          className="feature-icon"
          style={{
            background: member?.color ? `${member.color}33` : 'var(--secondary)',
            color: 'var(--primary)',
          }}
        >
          <Pill className="size-5" />
        </span>
        <div className="min-w-0">
          <h3>{medicine.name}</h3>
          <p>{medicine.dosage || '1 dose'}</p>
        </div>
        <span
          className={`pill-label ${
            status === 'missed'
              ? 'bg-destructive/15 text-destructive'
              : status === 'taken'
              ? 'bg-primary/15 text-primary'
              : status === 'upcoming'
              ? 'bg-secondary text-primary'
              : 'bg-peach text-peach-ink'
          }`}
        >
          {status === 'taken'
            ? 'Taken'
            : status === 'missed'
            ? 'Due now'
            : status === 'skipped'
            ? 'Skipped'
            : 'Upcoming'}
        </span>
      </div>

      <div className="dose-detail">
        <Clock3 className="size-3.5" />
        <span>{formatTimeDisplay(scheduledTime)}</span>
        <span className="mx-1">·</span>
        <span className="font-medium" style={{ color: member?.color || 'inherit' }}>
          {memberName}
        </span>
        <span className="ml-auto pill-label bg-muted capitalize">{medicine.type || 'Maintenance'}</span>
      </div>

      {status === 'taken' ? (
        <button
          type="button"
          className="w-full h-14 min-h-[56px] rounded-xl bg-secondary text-primary text-[18px] font-semibold flex items-center justify-center gap-2 cursor-pointer hover:bg-secondary/80 transition-colors"
          onClick={() => onDoseAction(doseItem, 'undo')}
        >
          <CheckCircle2 className="size-5" />
          Taken · undo
        </button>
      ) : (
        <div className="dose-actions">
          <button
            type="button"
            className="h-14 min-h-[56px] rounded-xl bg-primary text-primary-foreground text-[18px] font-semibold flex items-center justify-center gap-2 cursor-pointer hover:bg-primary/90 transition-colors"
            onClick={() => onDoseAction(doseItem, 'taken')}
          >
            <Check className="size-5" />
            Mark as taken
          </button>
          <button
            type="button"
            className="h-14 min-h-[56px] w-14 rounded-xl border-2 border-border bg-card flex items-center justify-center text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Snooze"
            aria-label={`Snooze ${medicine.name}`}
            onClick={() => onDoseAction(doseItem, 'snooze')}
          >
            <Clock3 className="size-5" />
          </button>
          <button
            type="button"
            className="h-14 min-h-[56px] w-14 rounded-xl border-2 border-border bg-card flex items-center justify-center text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Skip dose"
            aria-label={`Skip ${medicine.name}`}
            onClick={() => onDoseAction(doseItem, 'skipped')}
          >
            <MoreHorizontal className="size-5" />
          </button>
        </div>
      )}

      <div className="dose-footer">
        <Users className="size-3" />
        <span>Visible to your family</span>
        <span className="ml-auto">{medicine.stock ?? 0} doses left</span>
      </div>
    </article>
  );
}

function HomeEventRow({
  event,
  member,
  onClick,
}: {
  event: CalendarEvent;
  member?: Member;
  onClick?: () => void;
}) {
  const { month, day } = formatEventDate(event.date);
  const memberLabel = member?.name ?? (event.memberId ? 'Family' : 'All');

  return (
    <div
      className="event-row cursor-pointer hover:bg-muted/40 transition-colors px-1 rounded-md"
      onClick={onClick}
    >
      <div className="date-tile">
        <span>{month}</span>
        <strong>{day}</strong>
      </div>
      <div className="min-w-0">
        <h3>{event.title}</h3>
        <p>
          {event.time ? formatTimeDisplay(event.time) : 'All day'}
          <span className="mx-1">·</span>
          <span>{memberLabel}</span>
          {event.location && <span className="text-muted-foreground ml-1">({event.location})</span>}
        </p>
      </div>
      <span className="pill-label bg-secondary text-primary">
        {memberLabel}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main HomeScreen Component
// ---------------------------------------------------------------------------
export function HomeScreen({ onNavigate, onOpenMember, onMagicAdd }: HomeScreenProps) {
  const currentMemberId = getCurrentMemberId();

  // Reactive data queries from Dexie repositories/tables
  const members = useLiveQuery(async () => {
    const list = await db.members.toArray();
    return list.filter((m: Member) => !m.deleted);
  }, []) ?? [];

  const medicines = useLiveQuery(async () => {
    const list = await db.medicines.toArray();
    return list.filter((m: Medicine) => !m.deleted);
  }, []) ?? [];

  const doseLogs = useLiveQuery(async () => {
    const list = await db.doseLogs.toArray();
    return list.filter((l: DoseLog) => !l.deleted);
  }, []) ?? [];

  const events = useLiveQuery(async () => {
    const list = await db.events.toArray();
    return list.filter((e: CalendarEvent) => !e.deleted);
  }, []) ?? [];

  const bills = useLiveQuery(async () => {
    const list = await db.bills.toArray();
    return list.filter((b: Bill) => !b.deleted);
  }, []) ?? [];

  const groceries = useLiveQuery(async () => {
    const list = await db.groceryItems.toArray();
    return list.filter((g: GroceryItem) => !g.deleted);
  }, []) ?? [];

  const debts = useLiveQuery(async () => {
    const list = await db.debts.toArray();
    return list.filter((d: Debt) => !d.deleted);
  }, []) ?? [];

  const memberMap = new Map<string, Member>(members.map((m: Member) => [m.id, m]));
  const memberNameMap: Record<string, string> = Object.fromEntries(
    members.map((m: Member) => [m.id, m.name])
  );

  const currentMember = members.find((m: Member) => m.id === currentMemberId) ?? members[0];
  const now = new Date();

  // Pure logic calculations
  const todayDoseList = todaysDoses(medicines, doseLogs, now);
  const featuredDose = todayDoseList.length > 0 ? todayDoseList[0] : null;
  const upcomingEvent = nextEvent(events, now);
  const dueBills = billsDueSoon(bills, now, 7);
  const remainingGroceries = groceryCount(groceries);
  const debtLines = debtSummaryLines(debts, currentMember?.id ?? currentMemberId ?? 'me', memberNameMap);

  // Today formatted greeting
  const weekdayOptions: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
  const todayFormatted = now.toLocaleDateString('en-US', weekdayOptions).toUpperCase();

  const getGreeting = () => {
    const hour = now.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const handleDoseAction = async (
    doseItem: DoseWithStatus,
    action: 'taken' | 'snooze' | 'skipped' | 'undo'
  ) => {
    const todayStr = now.toISOString().slice(0, 10);
    const scheduledAt = `${todayStr}T${doseItem.scheduledTime}:00`;

    if (action === 'undo' && doseItem.doseLog) {
      await db.doseLogs.delete(doseItem.doseLog.id);
      return;
    }

    if (action === 'taken') {
      if (doseItem.doseLog) {
        await db.doseLogs.update(doseItem.doseLog.id, {
          status: 'taken',
          loggedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        await db.doseLogs.add({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          medicineId: doseItem.medicine.id,
          scheduledAt,
          status: 'taken',
          loggedBy: currentMember?.id ?? 'me',
          loggedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          updatedBy: currentMember?.id ?? 'me',
          deleted: false,
        });
      }
    } else if (action === 'skipped') {
      if (doseItem.doseLog) {
        await db.doseLogs.update(doseItem.doseLog.id, {
          status: 'skipped',
          loggedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        await db.doseLogs.add({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          medicineId: doseItem.medicine.id,
          scheduledAt,
          status: 'skipped',
          loggedBy: currentMember?.id ?? 'me',
          loggedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          updatedBy: currentMember?.id ?? 'me',
          deleted: false,
        });
      }
    }
  };

  return (
    <div className="home-screen pb-16 space-y-6">
      {/* 1. Welcome Greeting */}
      <section className="welcome">
        <div className="eyebrow">{todayFormatted}</div>
        <h1 className="text-[26px] font-extrabold text-foreground tracking-tight">
          {getGreeting()},{' '}
          <span className="text-primary">{currentMember?.name ?? 'there'}</span>{' '}
          <span className="text-2xl" role="img" aria-label="sun">
            ☀️
          </span>
        </h1>
        <p className="text-[18px] text-muted-foreground mt-1">A little care. A happier home.</p>
      </section>

      {/* 2. Family Circle Strip */}
      <section>
        <SectionTitle
          title="Your family circle"
          onAction={() => onNavigate?.('household')}
          actionLabel="See all"
        />
        {members.length === 0 ? (
          <div className="py-6 px-4 rounded-xl border border-dashed border-border text-center text-muted-foreground bg-card">
            <Users className="mx-auto mb-2 size-6 text-muted-foreground/60" />
            <p className="text-[18px]">No family members yet.</p>
            <button
              type="button"
              className="mt-2 text-primary font-semibold hover:underline text-[18px] cursor-pointer"
              onClick={() => onNavigate?.('household')}
            >
              Add member
            </button>
          </div>
        ) : (
          <div className="family-strip overflow-x-auto pb-2 scrollbar-none flex gap-4">
            {members.map((m: Member) => (
              <button
                key={m.id}
                type="button"
                className="member h-auto p-0 hover:opacity-85 transition-opacity cursor-pointer border-0 bg-transparent flex flex-col items-center"
                onClick={() => {
                  if (onOpenMember) {
                    onOpenMember(m);
                  } else {
                    onNavigate?.('household');
                  }
                }}
              >
                <MemberAvatar member={m} />
                <span className="member-name mt-1 text-sm font-semibold">{m.name}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 3. Magic Banner */}
      <button
        type="button"
        className="magic-banner w-full h-auto whitespace-normal text-left cursor-pointer transition-transform active:scale-[0.99] border-0"
        onClick={() => onMagicAdd?.()}
      >
        <span className="magic-icon">
          <Sparkles className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <h3 className="text-[18px] font-bold">A little magic for your day</h3>
          <p className="text-sm text-muted-foreground">Add it in your own words. We’ll sort it out.</p>
        </span>
        <ChevronRight className="text-primary size-5 shrink-0" />
      </button>

      {/* 4. Today's Dose Card */}
      <section>
        <SectionTitle
          title="A dose of care"
          onAction={() => onNavigate?.('meds')}
          actionLabel="View all"
        />
        {featuredDose ? (
          <HomeDoseCard
            doseItem={featuredDose}
            member={memberMap.get(featuredDose.medicine.memberId)}
            onDoseAction={handleDoseAction}
          />
        ) : (
          <div className="py-8 px-4 rounded-xl border border-dashed border-border text-center text-muted-foreground bg-card">
            <Pill className="mx-auto mb-2 size-8 text-primary/60" />
            <p className="text-[18px] font-semibold text-foreground">No doses scheduled for today</p>
            <p className="text-sm text-muted-foreground mt-1">All family medications are up to date.</p>
            <button
              type="button"
              className="mt-3 text-primary font-semibold text-[18px] hover:underline cursor-pointer"
              onClick={() => onNavigate?.('meds')}
            >
              Add medication
            </button>
          </div>
        )}
      </section>

      {/* 5. Around the house: Quick Grid */}
      <section className="mt-7">
        <SectionTitle title="Around the house" />
        <div className="quick-grid">
          {/* Calendar Tile */}
          <button
            type="button"
            className="quick-card cursor-pointer hover:bg-muted/30 transition-colors border-0"
            onClick={() => onNavigate?.('calendar')}
          >
            <span className="feature-icon bg-sky text-sky-ink">
              <CalendarDays className="size-5" />
            </span>
            <ArrowUpRight className="corner-arrow" />
            <h3 className="text-[18px] font-bold">Family calendar</h3>
            <p className="text-sm text-muted-foreground">
              {events.length === 0
                ? 'No events scheduled'
                : `${events.length} event${events.length === 1 ? '' : 's'} coming up`}
            </p>
          </button>

          {/* Grocery Tile */}
          <button
            type="button"
            className="quick-card cursor-pointer hover:bg-muted/30 transition-colors border-0"
            onClick={() => onNavigate?.('lists')}
          >
            <span className="feature-icon bg-peach text-peach-ink">
              <ShoppingBasket className="size-5" />
            </span>
            <ArrowUpRight className="corner-arrow" />
            <h3 className="text-[18px] font-bold">Grocery list</h3>
            <p className="text-sm text-muted-foreground">
              {remainingGroceries === 0
                ? 'All picked up'
                : `${remainingGroceries} item${remainingGroceries === 1 ? '' : 's'} to pick up`}
            </p>
          </button>

          {/* Debts / Balances Tile */}
          <button
            type="button"
            className="quick-card cursor-pointer hover:bg-muted/30 transition-colors border-0"
            onClick={() => onNavigate?.('debts')}
          >
            <span className="feature-icon bg-lilac text-lilac-ink">
              <Wallet className="size-5" />
            </span>
            <ArrowUpRight className="corner-arrow" />
            <h3 className="text-[18px] font-bold">Family balances</h3>
            <p className="text-sm text-muted-foreground">
              {debtLines.length === 0 ? 'All settled' : `${debtLines.length} active balance${debtLines.length === 1 ? '' : 's'}`}
            </p>
          </button>

          {/* Medicine Cabinet Tile */}
          <button
            type="button"
            className="quick-card cursor-pointer hover:bg-muted/30 transition-colors border-0"
            onClick={() => onNavigate?.('meds')}
          >
            <span className="feature-icon bg-secondary text-primary">
              <Pill className="size-5" />
            </span>
            <ArrowUpRight className="corner-arrow" />
            <h3 className="text-[18px] font-bold">Medicine cabinet</h3>
            <p className="text-sm text-muted-foreground">
              {medicines.length === 0
                ? 'Empty cabinet'
                : `${medicines.length} medicine${medicines.length === 1 ? '' : 's'} · all in one place`}
            </p>
          </button>
        </div>
      </section>

      {/* 6. Bills Due Soon */}
      <section className="mt-7">
        <SectionTitle
          title="Bills due soon"
          onAction={() => onNavigate?.('lists')}
          actionLabel="View lists"
        />
        {dueBills.length === 0 ? (
          <div className="py-6 px-4 rounded-xl border border-dashed border-border text-center text-muted-foreground bg-card">
            <p className="text-[18px]">No upcoming bills due this week.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dueBills.slice(0, 3).map((bill: Bill) => (
              <div
                key={bill.id}
                className="list-row cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => onNavigate?.('lists')}
              >
                <span className="feature-icon bg-sky text-sky-ink">
                  <Wallet className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[18px] font-bold">{bill.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Due {bill.dueDate}{' '}
                    {bill.responsibleMemberId && memberNameMap[bill.responsibleMemberId]
                      ? `· ${memberNameMap[bill.responsibleMemberId]}`
                      : ''}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-[18px] text-foreground">
                    ₱{(bill.amount / (bill.amount > 1000 ? 1 : 1)).toLocaleString('en-PH')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 7. Next Event / Coming Up */}
      <section className="mt-7">
        <SectionTitle
          title="Coming up"
          onAction={() => onNavigate?.('calendar')}
          actionLabel="See calendar"
        />
        {upcomingEvent ? (
          <HomeEventRow
            event={upcomingEvent}
            member={upcomingEvent.memberId ? memberMap.get(upcomingEvent.memberId) : undefined}
            onClick={() => onNavigate?.('calendar')}
          />
        ) : (
          <div className="py-8 px-4 rounded-xl border border-dashed border-border text-center text-muted-foreground bg-card">
            <CalendarDays className="mx-auto mb-2 size-8 text-sky-ink/60" />
            <p className="text-[18px] font-semibold text-foreground">A little breathing room</p>
            <p className="text-sm text-muted-foreground mt-1">No upcoming events on the calendar.</p>
            <button
              type="button"
              className="mt-3 text-primary font-semibold text-[18px] hover:underline cursor-pointer"
              onClick={() => onNavigate?.('calendar')}
            >
              Add an event
            </button>
          </div>
        )}
      </section>

      {/* 8. Debts / Family Balances Summary */}
      <section className="mt-7">
        <SectionTitle
          title="With your family"
          onAction={() => onNavigate?.('debts')}
          actionLabel="See balances"
        />
        {debtLines.length === 0 ? (
          <div className="py-6 px-4 rounded-xl border border-dashed border-border text-center text-muted-foreground bg-card">
            <p className="text-[18px]">All family balances are settled.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {debtLines.map((line: { memberId: string; text: string; netCentavos: number }) => {
              const targetMember = members.find((m: Member) => m.id === line.memberId);
              return (
                <div
                  key={line.memberId}
                  className="list-row cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => onNavigate?.('debts')}
                >
                  {targetMember ? (
                    <MemberAvatar member={targetMember} />
                  ) : (
                    <span className="member-avatar bg-secondary">?</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[18px] font-bold">{line.text}</h3>
                  </div>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Footer reassurance */}
      <div className="mt-8 flex justify-center items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="size-4 text-primary" />
        <span>Your family. Your device. Your peace of mind.</span>
      </div>

      {/* Floating Magic Add FAB */}
      <button
        type="button"
        aria-label="Magic Add"
        className="fixed bottom-24 right-6 z-40 h-14 w-14 min-h-[56px] min-w-[56px] rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all cursor-pointer border-0"
        onClick={() => onMagicAdd?.()}
      >
        <Sparkles className="size-6" />
      </button>
    </div>
  );
}
