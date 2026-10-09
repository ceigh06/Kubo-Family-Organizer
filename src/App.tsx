import { useState, useEffect } from 'react';
import { getCurrentUserId } from './features/household/auth';
import { getCurrentMemberId } from './features/household/currentMember';
import { db } from './db';
import { SignInScreen } from './features/household/components/SignInScreen';
import { CreateOrJoinScreen } from './features/household/components/CreateOrJoinScreen';
import { FamilyHubScreen } from './features/household/components/FamilyHubScreen';
import { MemberProfileScreen } from './features/household/components/MemberProfileScreen';
import type { Member } from './db/schema';

type Screen =
  | { name: 'sign-in' }
  | { name: 'create-or-join' }
  | { name: 'hub'; householdId: string }
  | { name: 'member-profile'; memberId: string };

async function resolveInitialScreen(): Promise<Screen> {
  const userId = getCurrentUserId();
  if (!userId) return { name: 'sign-in' };

  const memberId = getCurrentMemberId();
  if (!memberId) return { name: 'create-or-join' };

  const member = await db.members.get(memberId);
  if (!member || member.deleted) return { name: 'create-or-join' };

  return { name: 'hub', householdId: member.householdId };
}

export default function App() {
  const [screen, setScreen] = useState<Screen | null>(null);

  useEffect(() => {
    resolveInitialScreen().then(setScreen);
  }, []);

  if (!screen) {
    return (
      <div className="app-shell flex items-center justify-center min-h-dvh">
        <span className="text-[18px] text-muted-foreground">Loading…</span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {screen.name === 'sign-in' && (
        <SignInScreen onSuccess={() => setScreen({ name: 'create-or-join' })} />
      )}

      {screen.name === 'create-or-join' && (
        <CreateOrJoinScreen
          onDone={(householdId) => setScreen({ name: 'hub', householdId })}
          onNeedSignIn={() => setScreen({ name: 'sign-in' })}
        />
      )}

      {screen.name === 'hub' && (
        <FamilyHubScreen
          householdId={screen.householdId}
          onOpenMember={(member: Member) =>
            setScreen({ name: 'member-profile', memberId: member.id })
          }
        />
      )}

      {screen.name === 'member-profile' && (
        <MemberProfileScreen
          memberId={screen.memberId}
          onBack={() => {
            const memberId = getCurrentMemberId();
            db.members.get(memberId ?? '').then((m) => {
              if (m && !m.deleted) setScreen({ name: 'hub', householdId: m.householdId });
              else setScreen({ name: 'create-or-join' });
            });
          }}
        />
      )}
    </div>
  );
}
