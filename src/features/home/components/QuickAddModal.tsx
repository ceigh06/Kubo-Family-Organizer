import React from 'react';
import { X, Pill, CalendarDays, ShoppingBasket, Wallet, ArrowRightLeft, Sparkles } from 'lucide-react';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (tab: 'home' | 'meds' | 'calendar' | 'lists' | 'debts' | 'household') => void;
  onMagicAdd?: () => void;
}

export function QuickAddModal({
  isOpen,
  onClose,
  onNavigate,
  onMagicAdd,
}: QuickAddModalProps) {
  if (!isOpen) return null;

  const actions = [
    {
      title: 'Magic Add (AI)',
      desc: 'Type or speak naturally, Kubo sorts it out',
      icon: Sparkles,
      color: 'bg-gradient-to-r from-amber-500 to-rose-500 text-white',
      onClick: () => {
        onClose();
        onMagicAdd?.();
      },
    },
    {
      title: 'Medication or Dose',
      desc: 'Add to the family medicine cabinet',
      icon: Pill,
      color: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
      onClick: () => {
        onClose();
        onNavigate?.('meds');
      },
    },
    {
      title: 'Calendar Event',
      desc: 'Doctor appointments, birthdays, family plans',
      icon: CalendarDays,
      color: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
      onClick: () => {
        onClose();
        onNavigate?.('calendar');
      },
    },
    {
      title: 'Grocery or Task',
      desc: 'Add items to the shared family lists',
      icon: ShoppingBasket,
      color: 'bg-peach text-peach-ink border border-peach-ink/20',
      onClick: () => {
        onClose();
        onNavigate?.('lists');
      },
    },
    {
      title: 'Bill or Household Expense',
      desc: 'Record utility bills, due dates, or rent',
      icon: Wallet,
      color: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      onClick: () => {
        onClose();
        onNavigate?.('lists');
      },
    },
    {
      title: 'Family Debt / Balance',
      desc: 'Track IOUs and split expenses fairly',
      icon: ArrowRightLeft,
      color: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
      onClick: () => {
        onClose();
        onNavigate?.('debts');
      },
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-end sm:justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-[420px] bg-[#112314] border border-[#B2D959]/40 rounded-[28px] shadow-2xl overflow-hidden p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[18px] font-bold text-white tracking-tight">Quick Action</h3>
            <p className="text-xs text-[#B2D959]">What would you like to add today?</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-full bg-[#1c3822] text-[#FED24F] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {actions.map((act, idx) => {
            const Icon = act.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={act.onClick}
                className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-left transition-all cursor-pointer group active:scale-[0.98]"
              >
                <div
                  className={`size-11 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${act.color}`}
                >
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-[14px] font-semibold text-white tracking-tight">{act.title}</h4>
                  <p className="text-[11.5px] text-zinc-400 truncate">{act.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
