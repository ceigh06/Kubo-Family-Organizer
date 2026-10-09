import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Pill,
  CalendarDays,
  ShoppingBasket,
  Wallet,
  ArrowRightLeft,
  CheckCircle2,
  Mic,
  MicOff,
  ArrowRight,
  Bot,
} from 'lucide-react';
import { db } from '@/db';
import type { Member } from '@/db/schema';
import { getCurrentMemberId } from '@/features/household/currentMember';

interface MagicAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (tab: 'home' | 'meds' | 'calendar' | 'lists' | 'debts' | 'household') => void;
  members: Member[];
}

type ParsedType = 'grocery' | 'event' | 'reminder' | 'bill' | 'debt' | 'medicine';

interface ParsedResult {
  type: ParsedType;
  title: string;
  amount?: number;
  date?: string;
  time?: string;
  memberId?: string;
  memberName?: string;
  category?: string;
  dosage?: string;
  reason?: string;
  direction?: 'owe' | 'owed';
}

function parseNaturalLanguage(input: string, members: Member[]): ParsedResult {
  const text = input.trim();
  const lower = text.toLowerCase();

  // Find mentioned member
  const foundMember = members.find((m) =>
    lower.includes(m.name.toLowerCase()) ||
    (m.roleLabel && lower.includes(m.roleLabel.toLowerCase()))
  );

  // Extract amounts like ₱500, 500 pesos, $50, 500
  const amountMatch = text.match(/(?:₱|\$|php|pesos?)?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/i);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : undefined;

  // Extract dates
  const today = new Date();
  let dateStr = today.toISOString().split('T')[0];
  if (lower.includes('tomorrow')) {
    const tm = new Date(today);
    tm.setDate(tm.getDate() + 1);
    dateStr = tm.toISOString().split('T')[0];
  } else if (lower.includes('next week')) {
    const nw = new Date(today);
    nw.setDate(nw.getDate() + 7);
    dateStr = nw.toISOString().split('T')[0];
  }

  // Extract time like 8:00am, 2pm, 10:30
  const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  let timeStr: string | undefined = undefined;
  if (timeMatch && (lower.includes('am') || lower.includes('pm') || lower.includes('at ') || lower.includes(':'))) {
    let hours = parseInt(timeMatch[1], 10);
    const mins = timeMatch[2] ? timeMatch[2].padStart(2, '0') : '00';
    const ampm = timeMatch[3]?.toLowerCase();
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    timeStr = `${hours.toString().padStart(2, '0')}:${mins}`;
  }

  // 1. Debt check: "owes", "borrowed", "lent", "paid for"
  if (lower.includes('owe') || lower.includes('borrow') || lower.includes('lent') || lower.includes('share') || lower.includes('bayad')) {
    const isOwed = lower.includes('owes me') || lower.includes('lent') || lower.includes('paid for');
    return {
      type: 'debt',
      title: text,
      amount: amount || 100,
      reason: text.replace(/(?:₱|\$|\d+|owes me|you owe|borrowed|lent)/gi, '').trim() || 'Shared expense',
      memberId: foundMember?.id,
      memberName: foundMember?.name,
      direction: isOwed ? 'owed' : 'owe',
    };
  }

  // 2. Bill check: "bill", "meralco", "maynilad", "electric", "water", "rent", "wifi", "internet", "due"
  if (lower.includes('bill') || lower.includes('meralco') || lower.includes('maynilad') || lower.includes('electric') || lower.includes('water') || lower.includes('rent') || lower.includes('internet') || lower.includes('wifi')) {
    let billName = 'Utility Bill';
    if (lower.includes('meralco') || lower.includes('electric')) billName = 'Meralco Electric Bill';
    else if (lower.includes('maynilad') || lower.includes('water')) billName = 'Water Bill';
    else if (lower.includes('internet') || lower.includes('wifi')) billName = 'Internet / Wi-Fi';
    else if (lower.includes('rent')) billName = 'House Rent';
    else billName = text.replace(/(?:₱|\$|\d+|due|bill)/gi, '').trim() || 'Household Bill';

    return {
      type: 'bill',
      title: billName,
      amount: amount || 1500,
      date: dateStr,
      memberId: foundMember?.id,
      memberName: foundMember?.name,
    };
  }

  // 3. Medicine check: "medicine", "pill", "tablet", "capsule", "dose", "take", "mg", "paracetamol", "losartan", "biogesic", "amoxicillin"
  if (lower.includes('medicine') || lower.includes('pill') || lower.includes('tablet') || lower.includes('capsule') || lower.includes('dose') || lower.includes(' mg') || lower.includes('biogesic') || lower.includes('losartan') || lower.includes('paracetamol')) {
    const dosageMatch = text.match(/(\d+\s*(?:mg|ml|mcg|tablets?|capsules?))/i);
    return {
      type: 'medicine',
      title: text.replace(/take\s+/i, '').replace(/\bat\s+\d+.*$/i, '').trim(),
      dosage: dosageMatch ? dosageMatch[1] : '500 mg · 1 tablet',
      time: timeStr || '08:00',
      memberId: foundMember?.id,
      memberName: foundMember?.name,
    };
  }

  // 4. Calendar Event check: "appointment", "doctor", "birthday", "party", "meeting", "dinner", "visit", "clinic", "flight"
  if (lower.includes('appointment') || lower.includes('doctor') || lower.includes('birthday') || lower.includes('party') || lower.includes('dinner') || lower.includes('meeting') || lower.includes('visit') || lower.includes('clinic')) {
    return {
      type: 'event',
      title: text.replace(/\bat\s+\d+.*$/i, '').replace(/\b(?:on|tomorrow|next week)\b.*$/i, '').trim() || text,
      date: dateStr,
      time: timeStr || '10:00',
      memberId: foundMember?.id,
      memberName: foundMember?.name,
    };
  }

  // 5. Default to Grocery Item: "buy", "pick up", "get", "need", "grocery"
  const cleanGrocery = text
    .replace(/^(?:buy|get|pick up|need|add)\s+/i, '')
    .replace(/(?:to the grocery list|to list)$/i, '')
    .trim();

  let category = 'Pantry';
  if (lower.includes('milk') || lower.includes('cheese') || lower.includes('butter') || lower.includes('egg')) category = 'Dairy & Eggs';
  else if (lower.includes('apple') || lower.includes('banana') || lower.includes('vegetable') || lower.includes('fruit')) category = 'Produce';
  else if (lower.includes('chicken') || lower.includes('pork') || lower.includes('beef') || lower.includes('fish') || lower.includes('meat')) category = 'Meat & Seafood';
  else if (lower.includes('shampoo') || lower.includes('soap') || lower.includes('tissue') || lower.includes('toothpaste')) category = 'Household';

  return {
    type: 'grocery',
    title: cleanGrocery || text,
    category,
    memberId: foundMember?.id,
    memberName: foundMember?.name,
  };
}

export function MagicAddModal({
  isOpen,
  onClose,
  onNavigate,
  members,
}: MagicAddModalProps) {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const currentMemberId = getCurrentMemberId();
  const currentMember = members.find((m) => m.id === currentMemberId) ?? members[0];
  const myId = currentMember?.id ?? currentMemberId ?? 'me';

  const parsed = input.trim() ? parseNaturalLanguage(input, members) : null;

  useEffect(() => {
    if (!isOpen) {
      setInput('');
      setSuccessMessage(null);
      setIsListening(false);
    }
  }, [isOpen]);

  // Voice recognition toggle
  const toggleListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-PH';

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const handleConfirm = async () => {
    if (!parsed) return;
    setIsSubmitting(true);

    const now = new Date().toISOString();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    try {
      if (parsed.type === 'grocery') {
        await db.groceryItems.add({
          id,
          householdId: currentMember?.householdId ?? 'local',
          name: parsed.title,
          category: parsed.category || 'Pantry',
          checked: false,
          addedBy: currentMember?.name ?? 'You',
          updatedAt: now,
          updatedBy: myId,
          deleted: false,
        });
        setSuccessMessage(`Added "${parsed.title}" to grocery list!`);
        setTimeout(() => {
          onClose();
          onNavigate?.('lists');
        }, 900);
      } else if (parsed.type === 'bill') {
        await db.bills.add({
          id,
          householdId: currentMember?.householdId ?? 'local',
          name: parsed.title,
          amount: parsed.amount || 1000,
          dueDate: parsed.date || now.split('T')[0],
          status: 'unpaid',
          responsibleMemberId: parsed.memberId || myId,
          recurring: true,
          updatedAt: now,
          updatedBy: myId,
          deleted: false,
        });
        setSuccessMessage(`Recorded bill "${parsed.title}" (₱${parsed.amount})!`);
        setTimeout(() => {
          onClose();
          onNavigate?.('lists');
        }, 900);
      } else if (parsed.type === 'debt') {
        const counterpartyId = parsed.memberId || (members.find((m) => m.id !== myId)?.id ?? 'family');
        await db.debts.add({
          id,
          householdId: currentMember?.householdId ?? 'local',
          fromId: parsed.direction === 'owe' ? myId : counterpartyId,
          toId: parsed.direction === 'owe' ? counterpartyId : myId,
          amount: parsed.amount || 100,
          reason: parsed.reason || parsed.title,
          settled: false,
          updatedAt: now,
          updatedBy: myId,
          deleted: false,
        });
        setSuccessMessage(`Saved family balance for ₱${parsed.amount}!`);
        setTimeout(() => {
          onClose();
          onNavigate?.('debts');
        }, 900);
      } else if (parsed.type === 'event') {
        await db.events.add({
          id,
          householdId: currentMember?.householdId ?? 'local',
          title: parsed.title,
          date: parsed.date || now.split('T')[0],
          time: parsed.time,
          memberId: parsed.memberId || 'everyone',
          createdBy: myId,
          updatedAt: now,
          updatedBy: myId,
          deleted: false,
        });
        setSuccessMessage(`Scheduled "${parsed.title}" on calendar!`);
        setTimeout(() => {
          onClose();
          onNavigate?.('calendar');
        }, 900);
      } else if (parsed.type === 'medicine') {
        await db.medicines.add({
          id,
          memberId: parsed.memberId || myId,
          name: parsed.title,
          dosage: parsed.dosage || '500 mg · 1 tablet',
          type: 'maintenance',
          timesPerDay: 1,
          scheduledTimes: [parsed.time || '08:00'],
          instructions: 'Take as directed',
          stock: 30,
          refillThreshold: 7,
          updatedAt: now,
          updatedBy: myId,
          deleted: false,
        });
        setSuccessMessage(`Added "${parsed.title}" to medicine cabinet!`);
        setTimeout(() => {
          onClose();
          onNavigate?.('meds');
        }, 900);
      }
    } catch (err) {
      console.error('Magic add error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="fixed bottom-0 left-1/2 z-[70] w-full max-w-[480px] -translate-x-1/2 rounded-t-3xl bg-[#112314] text-white p-6 pb-10 shadow-2xl border-t border-[#B2D959]/30 max-h-[88dvh] overflow-y-auto animate-in slide-in-from-bottom-6 duration-250"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-full bg-gradient-to-br from-[#FED24F] to-[#B2D959] flex items-center justify-center text-[#112314] shadow-md">
              <Sparkles className="size-5 fill-[#112314]" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold font-display leading-tight">Magic Add AI</h2>
              <p className="text-xs text-[#B2D959]">Type or speak naturally, Kubo sorts it out</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-full bg-[#1c3822] text-[#FED24F] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Input Bar */}
        <div className="relative mb-4">
          <input
            autoFocus
            type="text"
            className="w-full h-13 pl-4 pr-12 rounded-2xl bg-[#18341e] border border-[#B2D959]/40 text-white placeholder:text-[#8aa887] text-base focus:outline-none focus:ring-2 focus:ring-[#FED24F] transition-all"
            placeholder="e.g. Buy fresh milk, Lola checkup on Friday, Meralco bill 3200..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && parsed) {
                handleConfirm();
              }
            }}
          />
          <button
            type="button"
            onClick={toggleListening}
            className={`absolute right-2.5 top-1/2 -translate-y-1/2 size-8.5 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              isListening ? 'bg-rose-500 text-white animate-pulse' : 'bg-[#112314] text-[#B2D959] hover:text-white'
            }`}
            title={isListening ? 'Listening...' : 'Voice Dictation'}
          >
            {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          </button>
        </div>

        {/* Live Interpretation Preview Card */}
        {parsed && !successMessage && (
          <div className="mb-5 p-4 rounded-2xl bg-[#17301c] border border-[#B2D959]/30 shadow-md animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-[#25482b]">
              <span className="text-[11px] font-bold tracking-wider uppercase text-[#B2D959] flex items-center gap-1.5">
                <Bot className="size-3.5" /> Detected Action
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FED24F]/20 text-[#FED24F] border border-[#FED24F]/40 capitalize">
                {parsed.type}
              </span>
            </div>

            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl bg-[#234529] border border-[#B2D959]/30 flex items-center justify-center text-[#FED24F] shrink-0">
                {parsed.type === 'grocery' && <ShoppingBasket className="size-5" />}
                {parsed.type === 'bill' && <Wallet className="size-5" />}
                {parsed.type === 'debt' && <ArrowRightLeft className="size-5" />}
                {parsed.type === 'event' && <CalendarDays className="size-5" />}
                {parsed.type === 'medicine' && <Pill className="size-5" />}
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-white truncate">{parsed.title}</h3>
                <p className="text-xs text-[#b8d4b4] mt-0.5">
                  {parsed.type === 'grocery' && `Category: ${parsed.category}`}
                  {parsed.type === 'bill' && `Amount: ₱${parsed.amount?.toLocaleString('en-PH')} · Due: ${parsed.date}`}
                  {parsed.type === 'debt' && `${parsed.direction === 'owed' ? 'They owe you' : 'You owe'} ₱${parsed.amount?.toLocaleString('en-PH')}`}
                  {parsed.type === 'event' && `Date: ${parsed.date}${parsed.time ? ` at ${parsed.time}` : ''}`}
                  {parsed.type === 'medicine' && `Dosage: ${parsed.dosage} · Time: ${parsed.time}`}
                </p>
                {parsed.memberName && (
                  <span className="inline-block mt-1 text-[10.5px] font-medium text-[#FED24F] bg-[#FED24F]/10 px-2 py-0.5 rounded-md">
                    👤 For {parsed.memberName}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Quick Suggestion Pills */}
        {!input && (
          <div className="mb-4">
            <span className="text-[11px] font-semibold text-[#8aa887] uppercase tracking-wider block mb-2">
              Try saying or typing:
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                'Buy 2 fresh milk',
                'Meralco bill 2800 due on Friday',
                'Dad owes me 350 for lunch',
                'Lola doctor checkup tomorrow at 10am',
                'Take Biogesic 500mg at 8pm',
              ].map((example, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setInput(example)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#1a3720] hover:bg-[#254b2d] text-[#d6ecd3] border border-[#B2D959]/20 transition-all cursor-pointer text-left active:scale-95"
                >
                  "{example}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="mb-4 p-3.5 rounded-2xl bg-[#1e4225] border border-[#7EC151] flex items-center gap-2.5 text-[#e2f7de] text-sm font-semibold animate-in fade-in zoom-in-95">
            <CheckCircle2 className="size-5 text-[#7EC151] shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Confirm Button */}
        <button
          type="button"
          disabled={!parsed || isSubmitting}
          onClick={handleConfirm}
          className="h-12 w-full rounded-full bg-gradient-to-r from-[#FED24F] via-[#FFF449] to-[#B2D959] text-[#112314] font-extrabold text-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
        >
          <span>{isSubmitting ? 'Sorting it out…' : 'Confirm & Magic Add'}</span>
          <ArrowRight className="size-4" />
        </button>
      </div>
    </>
  );
}
