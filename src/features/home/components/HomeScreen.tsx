import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Search,
  Plus,
  Pill,
  CalendarDays,
  ShoppingBasket,
  Wallet,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  ArrowUpRight,
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
import { SearchModal } from './SearchModal';
import { QuickAddModal } from './QuickAddModal';

interface HomeScreenProps {
  onNavigate?: (tab: 'home' | 'meds' | 'calendar' | 'lists' | 'debts' | 'household') => void;
  onOpenMember?: (member: Member) => void;
  onMagicAdd?: () => void;
}

type FilterCategory = 'all' | 'care' | 'expenses' | 'calendar' | 'groceries';

export function HomeScreen({ onNavigate, onOpenMember, onMagicAdd }: HomeScreenProps) {
  const currentMemberId = getCurrentMemberId();

  // Modals state
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [filter, setFilter] = useState<FilterCategory>('all');

  // Reactive data queries
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

  const household = useLiveQuery(async () => {
    return await db.households.filter((h) => !h.deleted).first();
  }, []);

  const memberMap = new Map<string, Member>(members.map((m: Member) => [m.id, m]));
  const memberNameMap: Record<string, string> = Object.fromEntries(
    members.map((m: Member) => [m.id, m.name])
  );

  const currentMember = members.find((m: Member) => m.id === currentMemberId) ?? members[0];
  const now = new Date();

  const myId = currentMember?.id ?? currentMemberId ?? 'me';
  const isMe = (id: string) => id === 'me' || id === myId || (currentMember && id === currentMember.id);

  // Pure logic calculations
  const todayDoseList = todaysDoses(medicines, doseLogs, now);
  const upcomingEvent = nextEvent(events, now);
  const dueBills = billsDueSoon(bills, now, 7);
  const remainingGroceries = groceryCount(groceries);
  const debtLines = debtSummaryLines(debts, myId, memberNameMap);

  // Compute net family balance from real debt data
  const netDebtAmount = debts
    .filter((d) => !d.deleted && !d.settled)
    .reduce((sum, d) => {
      if (isMe(d.toId)) return sum + Number(d.amount);
      if (isMe(d.fromId)) return sum - Number(d.amount);
      return sum;
    }, 0);

  const netDebtFormatted = netDebtAmount === 0
    ? '₱0'
    : netDebtAmount > 0
    ? `+₱${netDebtAmount.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`
    : `−₱${Math.abs(netDebtAmount).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

  // Handle direct dose action
  const handleDoseAction = async (doseItem: DoseWithStatus, action: 'taken' | 'undo') => {
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
    }
  };

  return (
    <div className="min-h-screen bg-[#112314] text-[#f7fcf6] flex flex-col font-sans select-none antialiased">
      {/* 1. UPPER BOTANICAL ZONE (#FED24F, #FFF449, #B2D959, #7EC151 Palette) */}
      <div className="pt-4 pb-6 px-5 flex flex-col bg-gradient-to-b from-[#18311c] via-[#122515] to-[#0d1d10]">
        {/* Top Header Row with Logo + Profile */}
        <div className="flex items-center justify-between py-1 mb-2">
          {/* Logo */}
          <img
            src="/src/assets/kuboapp_logo.png"
            alt="Kubo"
            className="h-7 w-auto object-contain cursor-pointer"
            onClick={() => onNavigate?.('home')}
          />
          {/* Profile dot */}
          <div
            className="size-8 rounded-full bg-[#FED24F]/20 border border-[#FED24F]/40 flex items-center justify-center text-sm cursor-pointer hover:opacity-85 transition-opacity shadow-sm"
            onClick={() => onNavigate?.('household')}
            title="Family Profile"
          >
            🌸
          </div>
        </div>

        {/* Greeting and Action Buttons */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-[27px] font-extrabold text-[#ffffff] tracking-tight font-display leading-tight">
              Hello {currentMember?.name ?? 'Santos Family'}
            </h1>
            <p className="text-xs text-[#B2D959] mt-0.5 font-medium">
              {household?.name ?? 'Santos Family Hub'}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search Button */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="size-10 rounded-full bg-[#1c3822] hover:bg-[#254b2d] text-[#FED24F] hover:text-[#FFF449] border border-[#B2D959]/30 flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95"
              aria-label="Search"
            >
              <Search className="size-4.5" />
            </button>

            {/* Plus Button */}
            <button
              type="button"
              onClick={() => setQuickAddOpen(true)}
              className="size-10 rounded-full bg-[#1c3822] hover:bg-[#254b2d] text-[#FED24F] hover:text-[#FFF449] border border-[#B2D959]/30 flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95"
              aria-label="Add Item"
            >
              <Plus className="size-5" />
            </button>
          </div>
        </div>

        {/* Family Balances Headline & Magic AI Button */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <span className="text-[12px] font-semibold text-[#B2D959] tracking-wider uppercase">
              Family balances
            </span>
            <div className="text-[40px] font-extrabold tracking-tight text-white font-display leading-none mt-1">
              {netDebtFormatted}
            </div>
            <p className="text-[11px] text-[#B2D959]/70 mt-1">
              {netDebtAmount === 0 ? 'All settled up' : netDebtAmount > 0 ? 'owed to you' : 'you owe'}
            </p>
          </div>

          {/* Magic AI Round Button (Outline matching fill, icon colored with background green) */}
          <button
            type="button"
            onClick={() => onMagicAdd?.()}
            className="size-12 rounded-full bg-gradient-to-br from-[#FED24F] via-[#FFF449] to-[#B2D959] hover:brightness-110 flex items-center justify-center shadow-[0_6px_22px_rgba(254,210,79,0.45)] border border-transparent cursor-pointer active:scale-95 transition-all shrink-0"
            aria-label="Magic AI"
            title="Magic AI"
          >
            <Sparkles className="size-6 text-[#122515] fill-[#122515]" />
          </button>
        </div>

        {/* Quick Actions Row (Featuring all 4 palette colors: #FED24F, #7EC151, #B2D959, #FFF449) */}
        <div className="grid grid-cols-4 gap-2.5 pt-1">
          {/* Transfer button (#FED24F - Warm Sun Gold) */}
          <button
            type="button"
            onClick={() => onNavigate?.('debts')}
            className="flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-2xl bg-[#17301c]/90 hover:bg-[#214328] border border-[#FED24F]/30 text-white transition-all cursor-pointer active:scale-95 shadow-sm"
          >
            <div className="size-9 rounded-xl bg-[#FED24F]/20 text-[#FED24F] border border-[#FED24F]/40 flex items-center justify-center">
              <ArrowUpRight className="size-4.5" />
            </div>
            <span className="text-[11.5px] font-semibold text-[#e8f5e9]">Transfer</span>
          </button>

          {/* Care/Dose button (#7EC151 - Leaf Meadow Green) */}
          <button
            type="button"
            onClick={() => onNavigate?.('meds')}
            className="flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-2xl bg-[#17301c]/90 hover:bg-[#214328] border border-[#7EC151]/30 text-white transition-all cursor-pointer active:scale-95 shadow-sm"
          >
            <div className="size-9 rounded-xl bg-[#7EC151]/20 text-[#7EC151] border border-[#7EC151]/40 flex items-center justify-center">
              <Pill className="size-4.5" />
            </div>
            <span className="text-[11.5px] font-semibold text-[#e8f5e9]">Care/Dose</span>
          </button>

          {/* Agenda button (#B2D959 - Sprout Lime) */}
          <button
            type="button"
            onClick={() => onNavigate?.('calendar')}
            className="flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-2xl bg-[#17301c]/90 hover:bg-[#214328] border border-[#B2D959]/30 text-white transition-all cursor-pointer active:scale-95 shadow-sm"
          >
            <div className="size-9 rounded-xl bg-[#B2D959]/20 text-[#B2D959] border border-[#B2D959]/40 flex items-center justify-center">
              <CalendarDays className="size-4.5" />
            </div>
            <span className="text-[11.5px] font-semibold text-[#e8f5e9]">Agenda</span>
          </button>

          {/* Lists button (#FFF449 - Sunlight Yellow) */}
          <button
            type="button"
            onClick={() => onNavigate?.('lists')}
            className="flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-2xl bg-[#17301c]/90 hover:bg-[#214328] border border-[#FFF449]/30 text-white transition-all cursor-pointer active:scale-95 shadow-sm"
          >
            <div className="size-9 rounded-xl bg-[#FFF449]/20 text-[#FFF449] border border-[#FFF449]/40 flex items-center justify-center">
              <ShoppingBasket className="size-4.5" />
            </div>
            <span className="text-[11.5px] font-semibold text-[#e8f5e9]">Lists</span>
          </button>
        </div>
      </div>

      {/* 2. LOWER FRESH GARDEN SHEET (Luminous botanical cream surface) */}
      <div className="flex-1 bg-[#fbfcfa] text-[#122515] rounded-t-[34px] shadow-[0_-12px_40px_rgba(10,25,12,0.3)] px-6 pt-5 pb-36 transition-all mt-1 border-t border-[#e2ede0]">
        {/* Section Header: Family activity */}
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-[18px] font-bold text-[#122515] tracking-tight font-display">
            Family activity
          </h2>
          <button
            type="button"
            onClick={() => onNavigate?.('debts')}
            className="text-[12px] font-semibold text-[#5c7a5f] hover:text-[#27482a] transition-colors cursor-pointer bg-transparent border-0 p-0"
          >
            See all
          </button>
        </div>

        {/* Filter Pills with Palette Highlights */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-2 scrollbar-none">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-[#122515] text-[#FED24F]'
                : 'bg-[#edf4eb] text-[#3d593f] hover:bg-[#dfeade]'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter('care')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              filter === 'care'
                ? 'bg-[#7EC151] text-white shadow-sm'
                : 'bg-[#edf4eb] text-[#3d593f] hover:bg-[#dfeade]'
            }`}
          >
            <Pill className="size-3" />
            Care & Meds
          </button>
          <button
            type="button"
            onClick={() => setFilter('expenses')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              filter === 'expenses'
                ? 'bg-[#FED24F] text-[#122515] font-bold shadow-sm'
                : 'bg-[#edf4eb] text-[#3d593f] hover:bg-[#dfeade]'
            }`}
          >
            Expenses & Bills
          </button>
          <button
            type="button"
            onClick={() => setFilter('calendar')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              filter === 'calendar'
                ? 'bg-[#B2D959] text-[#122515] font-bold shadow-sm'
                : 'bg-[#edf4eb] text-[#3d593f] hover:bg-[#dfeade]'
            }`}
          >
            Calendar
          </button>
          <button
            type="button"
            onClick={() => setFilter('groceries')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              filter === 'groceries'
                ? 'bg-[#7EC151] text-white shadow-sm'
                : 'bg-[#edf4eb] text-[#3d593f] hover:bg-[#dfeade]'
            }`}
          >
            Groceries
          </button>
        </div>
        {/* Activity & Transaction Rows from Database */}
        <div className="divide-y divide-[#edf4ea]">
          {(filter === 'all' || filter === 'care') &&
            todayDoseList.slice(0, 3).map((doseItem, idx) => {
              const medMember = memberMap.get(doseItem.medicine.memberId);
              const isTaken = doseItem.status === 'taken';
              return (
                <div
                  key={`med-${idx}`}
                  className="flex items-center justify-between py-3.5 hover:bg-[#f3f9f2] rounded-xl px-2 transition-colors group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`size-11 rounded-full flex items-center justify-center shrink-0 transition-colors border ${
                        isTaken
                          ? 'bg-[#eff8ec] text-[#559a28] border-[#7EC151]/30'
                          : 'bg-[#eff8ec] text-[#7EC151] border-[#7EC151]/30'
                      }`}
                    >
                      <Pill className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-semibold text-[#122515] leading-tight truncate">
                        {doseItem.medicine.name}
                      </h3>
                      <p className="text-xs text-[#638066] mt-0.5">
                        {doseItem.scheduledTime} · {medMember?.name ?? 'Family'} ({doseItem.medicine.dosage || '1 dose'})
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {isTaken ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDoseAction(doseItem, 'undo');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#eff8ec] text-[#3f751d] hover:bg-[#e0f2da] transition-colors cursor-pointer border border-[#7EC151]/30"
                      >
                        <CheckCircle2 className="size-3.5" />
                        Taken
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDoseAction(doseItem, 'taken');
                        }}
                        className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#122515] text-[#FED24F] hover:bg-[#1a351f] active:scale-95 transition-all cursor-pointer shadow-sm"
                      >
                        Take
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

          {/* Due Bills from Database (#FED24F Accent) */}
          {(filter === 'all' || filter === 'expenses') &&
            dueBills.slice(0, 2).map((bill) => (
              <div
                key={`bill-${bill.id}`}
                className="flex items-center justify-between py-3.5 hover:bg-[#f3f9f2] rounded-xl px-2 transition-colors cursor-pointer group"
                onClick={() => onNavigate?.('lists')}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="size-11 rounded-full bg-[#fef8e7] text-[#a68616] border border-[#FED24F]/40 flex items-center justify-center shrink-0 group-hover:bg-[#fdf2d5] transition-colors">
                    <Wallet className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold text-[#122515] leading-tight truncate">
                      {bill.name}
                    </h3>
                    <p className="text-xs text-[#638066] mt-0.5">
                      Due {bill.dueDate}{' '}
                      {bill.responsibleMemberId && memberNameMap[bill.responsibleMemberId]
                        ? `· ${memberNameMap[bill.responsibleMemberId]}`
                        : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[15px] font-bold text-[#122515]">
                    ₱{bill.amount.toLocaleString('en-PH')}
                  </span>
                </div>
              </div>
            ))}

          {/* Upcoming Calendar Event from Database (#B2D959 Accent) */}
          {(filter === 'all' || filter === 'calendar') && upcomingEvent && (
            <div
              className="flex items-center justify-between py-3.5 hover:bg-[#f3f9f2] rounded-xl px-2 transition-colors cursor-pointer group"
              onClick={() => onNavigate?.('calendar')}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="size-11 rounded-full bg-[#f4faed] text-[#698a28] border border-[#B2D959]/40 flex items-center justify-center shrink-0 group-hover:bg-[#eaf5de] transition-colors">
                  <CalendarDays className="size-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-[#122515] leading-tight truncate">
                    {upcomingEvent.title}
                  </h3>
                  <p className="text-xs text-[#638066] mt-0.5">
                    {upcomingEvent.date} {upcomingEvent.time ? `· ${upcomingEvent.time}` : ''}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#f1f9e9] text-[#55761a] border border-[#B2D959]/30">
                  Upcoming
                </span>
              </div>
            </div>
          )}

          {/* Grocery Item Summary from Database (#FFF449 Accent) */}
          {(filter === 'all' || filter === 'groceries') && (
            <div
              className="flex items-center justify-between py-3.5 hover:bg-[#f3f9f2] rounded-xl px-2 transition-colors cursor-pointer group"
              onClick={() => onNavigate?.('lists')}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="size-11 rounded-full bg-[#fefde8] text-[#9c8b14] border border-[#FFF449]/50 flex items-center justify-center shrink-0 group-hover:bg-[#fefbc9] transition-colors">
                  <ShoppingBasket className="size-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-[#122515] leading-tight">
                    Grocery Checklist
                  </h3>
                  <p className="text-xs text-[#638066] mt-0.5">
                    {remainingGroceries === 0
                      ? 'All items picked up'
                      : `${remainingGroceries} items pending`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-[#5c7a5f]">
                  {remainingGroceries} items
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Family Circle Strip */}
        <div className="mt-8 pt-4 border-t border-[#edf4ea]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[#5c7a5f] uppercase tracking-wider">
              Family Circle
            </span>
            <button
              type="button"
              onClick={() => onNavigate?.('household')}
              className="text-xs font-semibold text-[#5c7a5f] hover:text-[#27482a] cursor-pointer"
            >
              Manage
            </button>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => (onOpenMember ? onOpenMember(m) : onNavigate?.('household'))}
                className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group p-1"
              >
                <div
                  className="size-12 rounded-full flex items-center justify-center font-bold text-base text-[#122515] shadow-sm border-2 border-[#B2D959]/50 transition-transform group-hover:scale-105"
                  style={{ background: m.color || '#e4eedf' }}
                >
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-[11px] font-semibold text-[#29462c] truncate max-w-[54px]">
                  {m.name}
                </span>
              </button>
            ))}

            {/* Add Member button */}
            <button
              type="button"
              onClick={() => onNavigate?.('household')}
              className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer p-1 group"
            >
              <div className="size-12 rounded-full border-2 border-dashed border-[#b6d4b2] flex items-center justify-center text-[#5c7a5f] group-hover:border-[#7EC151] group-hover:text-[#27482a] transition-colors">
                <Plus className="size-5" />
              </div>
              <span className="text-[11px] font-semibold text-[#5c7a5f]">Add</span>
            </button>
          </div>
        </div>

        {/* Reassurance Footer */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-[#638066] font-medium">
          <ShieldCheck className="size-3.5 text-[#7EC151]" />
          <span>Local SQLite · Zero Cloud Lock-in · Encrypted</span>
        </div>
      </div>

      {/* Search Modal */}
      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        members={members}
        medicines={medicines}
        events={events}
        bills={bills}
        groceries={groceries}
        onNavigate={onNavigate}
      />

      {/* Quick Add Modal */}
      <QuickAddModal
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onNavigate={onNavigate}
        onMagicAdd={onMagicAdd}
      />
    </div>
  );
}
