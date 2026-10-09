import { useState, useEffect } from 'react';
import { getCurrentUserId } from './features/household/auth';
import { getCurrentMemberId } from './features/household/currentMember';
import { db } from './db';
import { SignInScreen } from './features/household/components/SignInScreen';
import { CreateOrJoinScreen } from './features/household/components/CreateOrJoinScreen';
import { FamilyHubScreen } from './features/household/components/FamilyHubScreen';
import { MemberProfileScreen } from './features/household/components/MemberProfileScreen';
import { DebtsView } from './features/debts/DebtsView';
import { ListsView } from './features/lists';
import { CalendarView } from './features/calendar';
import { MedicineView } from './features/medicine';
import { HouseholdView } from './features/household';
import { Home, Pill, Calendar, CheckSquare, Wallet, Bell } from 'lucide-react';
import type { Member } from './db/schema';

type AuthScreen =
  | { name: 'sign-in' }
  | { name: 'create-or-join' }
  | { name: 'member-profile'; memberId: string };

type TabKey = 'home' | 'meds' | 'calendar' | 'lists' | 'debts' | 'household';

async function resolveInitialAuthScreen(): Promise<AuthScreen | null> {
  const userId = getCurrentUserId();
  if (!userId) return { name: 'sign-in' };

  const memberId = getCurrentMemberId();
  if (!memberId) return { name: 'create-or-join' };

  const member = await db.members.get(memberId);
  if (!member || member.deleted) return { name: 'create-or-join' };

  return null; // null means "authenticated, show main app"
}

export default function App() {
  const [authScreen, setAuthScreen] = useState<AuthScreen | null | 'loading'>('loading');
  const [activeHouseholdId, setActiveHouseholdId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('lists');

  useEffect(() => {
    resolveInitialAuthScreen().then((screen) => {
      setAuthScreen(screen);
      // If already authenticated, load the household
      if (screen === null) {
        const memberId = getCurrentMemberId();
        if (memberId) {
          db.members.get(memberId).then((m) => {
            if (m) setActiveHouseholdId(m.householdId);
          });
        }
      }
    });
  }, []);

  // Loading state
  if (authScreen === 'loading') {
    return (
      <div className="app-shell flex items-center justify-center min-h-dvh">
        <span className="text-[18px] text-muted-foreground">Loading…</span>
      </div>
    );
  }

  // Auth screens (no bottom nav)
  if (authScreen !== null) {
    if (authScreen.name === 'sign-in') {
      return (
        <div className="app-shell">
          <SignInScreen onSuccess={() => setAuthScreen({ name: 'create-or-join' })} />
        </div>
      );
    }

    if (authScreen.name === 'create-or-join') {
      return (
        <div className="app-shell">
          <CreateOrJoinScreen
            onDone={(householdId, _memberId) => {
              setActiveHouseholdId(householdId);
              setAuthScreen(null);
            }}
            onNeedSignIn={() => setAuthScreen({ name: 'sign-in' })}
          />
        </div>
      );
    }

    if (authScreen.name === 'member-profile') {
      return (
        <div className="app-shell">
          <MemberProfileScreen
            memberId={authScreen.memberId}
            onBack={() => {
              const memberId = getCurrentMemberId();
              db.members.get(memberId ?? '').then((m) => {
                if (m && !m.deleted) setAuthScreen(null);
                else setAuthScreen({ name: 'create-or-join' });
              });
            }}
          />
        </div>
      );
    }
  }

  // Main authenticated app shell with bottom navigation
  return (
    <div className="app-shell min-h-screen flex flex-col justify-between">
      {/* Mobile App Header */}
      <header className="app-header">
        <div className="brand cursor-pointer" onClick={() => setActiveTab('home')}>
          <svg
            className="brand-icon"
            viewBox="0 0 32 36"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M16 2L3 11V31C3 32.1 3.9 33 5 33H27C28.1 33 29 32.1 29 31V11L16 2Z"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M11 33V18H21V33"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Kubo</span>
        </div>
        <div className="header-actions">
          <button className="header-bell p-2 text-foreground/80 hover:text-foreground cursor-pointer" aria-label="Notifications">
            <Bell className="size-5" />
          </button>
          <div
            className="profile-dot cursor-pointer"
            title="Family Profile"
            onClick={() => setActiveTab('household')}
          >
            🌸
          </div>
        </div>
      </header>

      {/* Main Feature View */}
      <main className="page-body flex-1 page-enter" key={activeTab}>
        {activeTab === 'lists' && (
          <ListsView onNavigateToDebts={() => setActiveTab('debts')} />
        )}
        {activeTab === 'debts' && <DebtsView />}
        {activeTab === 'calendar' && <CalendarView />}
        {activeTab === 'meds' && <MedicineView />}
        {activeTab === 'household' && (
          activeHouseholdId
            ? <FamilyHubScreen
              householdId={activeHouseholdId}
              onOpenMember={(member: Member) =>
                setAuthScreen({ name: 'member-profile', memberId: member.id })
              }
            />
            : <HouseholdView />
        )}
        {activeTab === 'home' && (
          <div className="py-16 text-center text-muted-foreground">
            <Home className="mx-auto mb-3 size-10 text-primary/70" />
            <h2 className="text-lg font-bold text-foreground">Welcome to Kubo</h2>
            <p className="text-sm mt-1">Select Meds, Calendar, Lists, or Debts below.</p>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="nav-bar" aria-label="Mobile Navigation">
        <button
          type="button"
          className={`nav-item cursor-pointer border-0 bg-transparent ${activeTab === 'home' ? 'active' : 'opacity-60'}`}
          onClick={() => setActiveTab('home')}
        >
          <Home />
          <span>Home</span>
        </button>
        <button
          type="button"
          className={`nav-item cursor-pointer border-0 bg-transparent ${activeTab === 'meds' ? 'active' : 'opacity-60'}`}
          onClick={() => setActiveTab('meds')}
        >
          <Pill />
          <span>Meds</span>
        </button>
        <button
          type="button"
          className={`nav-item cursor-pointer border-0 bg-transparent ${activeTab === 'calendar' ? 'active' : 'opacity-60'}`}
          onClick={() => setActiveTab('calendar')}
        >
          <Calendar />
          <span>Calendar</span>
        </button>
        <button
          type="button"
          className={`nav-item cursor-pointer border-0 bg-transparent ${activeTab === 'lists' ? 'active' : 'opacity-60'}`}
          onClick={() => setActiveTab('lists')}
        >
          <CheckSquare />
          <span>Lists</span>
        </button>
        <button
          type="button"
          className={`nav-item cursor-pointer border-0 bg-transparent ${activeTab === 'debts' ? 'active' : 'opacity-60'}`}
          onClick={() => setActiveTab('debts')}
        >
          <Wallet />
          <span>Debts</span>
        </button>
      </nav>
    </div>
  );
}
