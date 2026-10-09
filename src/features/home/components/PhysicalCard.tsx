import React, { useState } from 'react';
import { Wifi, ShieldCheck, HeartPulse, Sparkles, ChevronRight, Check } from 'lucide-react';
import type { Member } from '@/db/schema';
import type { DoseWithStatus } from '../homeLogic';

export type CardMode = 'treasury' | 'care' | 'agenda';

interface PhysicalCardProps {
  currentMember?: Member;
  householdName?: string;
  totalBalanceCentavos: number;
  todayDoseList: DoseWithStatus[];
  remainingGroceries: number;
  upcomingEventTitle?: string;
  inviteCode?: string;
  onCardClick?: () => void;
}

export function PhysicalCard({
  currentMember,
  householdName = 'Santos Family',
  totalBalanceCentavos,
  todayDoseList,
  remainingGroceries,
  upcomingEventTitle,
  inviteCode = 'KUB-8492',
  onCardClick,
}: PhysicalCardProps) {
  const [activeMode, setActiveMode] = useState<CardMode>('treasury');

  const takenDosesCount = todayDoseList.filter((d) => d.status === 'taken').length;
  const totalDoses = todayDoseList.length;

  return (
    <div className="w-full max-w-[390px] mx-auto select-none">
      {/* Mode Switcher Tabs */}
      <div className="flex items-center justify-between px-2 mb-3">
        <div className="flex items-center gap-1.5 bg-zinc-900/90 border border-white/10 p-1 rounded-full text-[11px] font-medium">
          <button
            type="button"
            className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
              activeMode === 'treasury'
                ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setActiveMode('treasury');
            }}
          >
            Treasury
          </button>
          <button
            type="button"
            className={`px-3 py-1 rounded-full transition-all cursor-pointer flex items-center gap-1 ${
              activeMode === 'care'
                ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setActiveMode('care');
            }}
          >
            Care Pass
            {todayDoseList.length > 0 && (
              <span className="size-1.5 rounded-full bg-emerald-500 inline-block" />
            )}
          </button>
          <button
            type="button"
            className={`px-3 py-1 rounded-full transition-all cursor-pointer ${
              activeMode === 'agenda'
                ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setActiveMode('agenda');
            }}
          >
            Home Pass
          </button>
        </div>

        <span className="text-[10px] text-zinc-500 font-medium tracking-wide uppercase">
          Tap card to cycle
        </span>
      </div>

      {/* The Physical Card Container */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          // Cycle mode on tap
          setActiveMode((prev) => (prev === 'treasury' ? 'care' : prev === 'care' ? 'agenda' : 'treasury'));
          onCardClick?.();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setActiveMode((prev) => (prev === 'treasury' ? 'care' : prev === 'care' ? 'agenda' : 'treasury'));
          }
        }}
        className={`relative aspect-[1.586/1] w-full rounded-[24px] p-6 text-zinc-800 transition-all duration-300 transform active:scale-[0.98] cursor-pointer overflow-hidden shadow-[0_24px_48px_-10px_rgba(0,0,0,0.7),0_2px_6px_rgba(0,0,0,0.3)] border border-white/20 ${
          activeMode === 'treasury'
            ? 'bg-gradient-to-br from-[#e6e4df] via-[#dedbd3] to-[#c7c3b8]'
            : activeMode === 'care'
            ? 'bg-gradient-to-br from-[#e2ece9] via-[#d5e4df] to-[#bcd2cb]'
            : 'bg-gradient-to-br from-[#ebe6de] via-[#e2dad0] to-[#cbbeaf]'
        }`}
        style={{
          boxShadow:
            '0 28px 50px -12px rgba(0,0,0,0.75), 0 4px 16px rgba(0,0,0,0.25), inset 0 1px 1px rgba(255,255,255,0.9), inset 0 -1px 2px rgba(0,0,0,0.1)',
        }}
      >
        {/* Specular Radial Glare overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_25%_15%,rgba(255,255,255,0.65),transparent_65%)] pointer-events-none rounded-[24px]" />
        
        {/* Subtle holographic watermark shimmer */}
        <div className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-white/20 blur-xl pointer-events-none" />

        {/* Top Card Row */}
        <div className="relative z-10 flex items-start justify-between">
          {/* Smart Chip */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-8 rounded-[6px] bg-gradient-to-br from-[#ffd97d] via-[#f5c352] to-[#df9b20] border border-[#a87413]/50 relative shadow-inner overflow-hidden flex items-center justify-center">
              <div className="w-full h-[1px] bg-[#936307]/40 absolute top-1/2 -translate-y-1/2" />
              <div className="h-full w-[1px] bg-[#936307]/40 absolute left-1/3" />
              <div className="h-full w-[1px] bg-[#936307]/40 absolute right-1/3" />
              <div className="w-4 h-4 rounded-full border border-[#936307]/40 bg-transparent absolute" />
            </div>
            
            <div className="flex flex-col">
              <span className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                {activeMode === 'treasury'
                  ? 'Kubo Family Treasury'
                  : activeMode === 'care'
                  ? 'Kubo Care Pass'
                  : 'Kubo Household Pass'}
              </span>
              <span className="text-[11px] font-semibold text-zinc-700 tracking-tight">
                {householdName}
              </span>
            </div>
          </div>

          {/* Contactless Waves Icon (Matching Reference Image) */}
          <div className="text-zinc-500 hover:text-zinc-700 transition-colors">
            <svg
              className="w-7 h-7"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            >
              <path d="M8.5 16.5a4.5 4.5 0 0 1 0-6" />
              <path d="M12 19a8 8 0 0 1 0-11" />
              <path d="M15.5 21.5a11.5 11.5 0 0 1 0-16" />
            </svg>
          </div>
        </div>

        {/* Card Middle Body (Varies by Mode) */}
        <div className="relative z-10 mt-6 min-h-[46px] flex flex-col justify-center">
          {activeMode === 'treasury' && (
            <div>
              <div className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">
                Family Card Number
              </div>
              <div
                className="text-[17px] font-mono tracking-[0.22em] text-zinc-800 font-bold mt-0.5"
                style={{ textShadow: '0 1px 0 rgba(255,255,255,0.7)' }}
              >
                •••• &nbsp;•••• &nbsp;•••• &nbsp;8492
              </div>
            </div>
          )}

          {activeMode === 'care' && (
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                  Today's Care Status
                </span>
                <span className="text-[16px] font-extrabold text-emerald-800 tracking-tight flex items-center gap-1.5 mt-0.5">
                  <HeartPulse className="size-4 text-emerald-600" />
                  {totalDoses === 0
                    ? 'All doses up to date'
                    : `${takenDosesCount}/${totalDoses} doses taken`}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                  Code
                </span>
                <span className="text-[13px] font-mono font-bold text-zinc-700">{inviteCode}</span>
              </div>
            </div>
          )}

          {activeMode === 'agenda' && (
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                  Next Family Item
                </span>
                <span className="text-[15px] font-bold text-zinc-800 tracking-tight truncate max-w-[210px] block mt-0.5">
                  {upcomingEventTitle || 'Family dinner & planning'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                  Groceries
                </span>
                <span className="text-[13px] font-bold text-zinc-800">
                  {remainingGroceries} items left
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Card Footer (Matching Reference: Cardholder Name + Brand Logo) */}
        <div className="relative z-10 mt-auto pt-4 flex items-end justify-between">
          <div>
            <span className="block text-[8px] font-bold tracking-widest text-zinc-400 uppercase">
              Cardholder
            </span>
            <span
              className="text-[13px] font-semibold text-zinc-800 tracking-wide uppercase font-sans"
              style={{ textShadow: '0 1px 0 rgba(255,255,255,0.7)' }}
            >
              {currentMember?.name ? `${currentMember.name} · ${householdName}` : householdName}
            </span>
          </div>

          {/* VISA Platinum style Logo (Matching Reference Image) */}
          <div className="text-right flex flex-col items-end">
            <span
              className="font-black italic text-[20px] tracking-tight text-zinc-800 font-display leading-none"
              style={{ textShadow: '0 1px 0 rgba(255,255,255,0.8)' }}
            >
              VISA
            </span>
            <span className="text-[7.5px] tracking-[0.2em] text-zinc-500 font-extrabold uppercase mt-0.5">
              Platinum
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
