import React, { useState, useMemo } from 'react';
import { Search, X, Pill, CalendarDays, ShoppingBasket, Wallet, User, ArrowUpRight } from 'lucide-react';
import type { Member, Medicine, CalendarEvent, Bill, GroceryItem } from '@/db/schema';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  medicines: Medicine[];
  events: CalendarEvent[];
  bills: Bill[];
  groceries: GroceryItem[];
  onNavigate?: (tab: 'home' | 'meds' | 'calendar' | 'lists' | 'debts' | 'household') => void;
}

export function SearchModal({
  isOpen,
  onClose,
  members,
  medicines,
  events,
  bills,
  groceries,
  onNavigate,
}: SearchModalProps) {
  const [query, setQuery] = useState('');

  const trimmed = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!trimmed) return [];

    const list: {
      type: 'med' | 'event' | 'bill' | 'grocery' | 'member';
      title: string;
      subtitle: string;
      tab: 'meds' | 'calendar' | 'lists' | 'debts' | 'household';
    }[] = [];

    // Search medicines
    medicines.forEach((m) => {
      if (m.name.toLowerCase().includes(trimmed) || (m.dosage && m.dosage.toLowerCase().includes(trimmed))) {
        list.push({
          type: 'med',
          title: m.name,
          subtitle: `${m.dosage || '1 dose'} · ${m.type || 'Medicine'}`,
          tab: 'meds',
        });
      }
    });

    // Search events
    events.forEach((e) => {
      if (e.title.toLowerCase().includes(trimmed) || (e.location && e.location.toLowerCase().includes(trimmed))) {
        list.push({
          type: 'event',
          title: e.title,
          subtitle: `${e.date} ${e.time ? `· ${e.time}` : ''}`,
          tab: 'calendar',
        });
      }
    });

    // Search bills
    bills.forEach((b) => {
      if (b.name.toLowerCase().includes(trimmed)) {
        list.push({
          type: 'bill',
          title: b.name,
          subtitle: `₱${b.amount.toLocaleString()} · Due ${b.dueDate}`,
          tab: 'lists',
        });
      }
    });

    // Search groceries
    groceries.forEach((g) => {
      if (g.name.toLowerCase().includes(trimmed) || g.category.toLowerCase().includes(trimmed)) {
        list.push({
          type: 'grocery',
          title: g.name,
          subtitle: g.category || 'Grocery item',
          tab: 'lists',
        });
      }
    });

    // Search members
    members.forEach((m) => {
      if (m.name.toLowerCase().includes(trimmed) || m.roleLabel.toLowerCase().includes(trimmed)) {
        list.push({
          type: 'member',
          title: m.name,
          subtitle: m.roleLabel || 'Family member',
          tab: 'household',
        });
      }
    });

    return list.slice(0, 10);
  }, [trimmed, medicines, events, bills, groceries, members]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-start pt-12 px-4 animate-in fade-in duration-200">
      <div className="w-full max-w-[440px] bg-[#112314] border border-[#B2D959]/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-[#1c3822] flex items-center gap-3">
          <Search className="size-5 text-[#B2D959] shrink-0" />
          <input
            type="text"
            placeholder="Search meds, events, bills, groceries..."
            className="w-full bg-transparent text-[#ffffff] placeholder-[#5c7a5f] text-[15px] outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-full bg-[#1c3822] text-[#FED24F] hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-white/5">
          {trimmed && results.length === 0 && (
            <div className="py-8 text-center text-zinc-400 text-sm">
              No results found for "{query}"
            </div>
          )}

          {!trimmed && (
            <div className="p-4 text-xs text-zinc-500">
              Type to quickly search across medicines, upcoming calendar events, grocery list, and bills.
            </div>
          )}

          {results.map((res, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
              onClick={() => {
                onClose();
                onNavigate?.(res.tab);
              }}
            >
              <div className="flex items-center gap-3">
                <span className="size-9 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300">
                  {res.type === 'med' && <Pill className="size-4 text-emerald-400" />}
                  {res.type === 'event' && <CalendarDays className="size-4 text-sky-400" />}
                  {res.type === 'bill' && <Wallet className="size-4 text-amber-400" />}
                  {res.type === 'grocery' && <ShoppingBasket className="size-4 text-peach-ink" />}
                  {res.type === 'member' && <User className="size-4 text-indigo-400" />}
                </span>
                <div>
                  <h4 className="text-[14px] font-semibold text-white">{res.title}</h4>
                  <p className="text-xs text-zinc-400">{res.subtitle}</p>
                </div>
              </div>

              <ArrowUpRight className="size-4 text-zinc-500" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
