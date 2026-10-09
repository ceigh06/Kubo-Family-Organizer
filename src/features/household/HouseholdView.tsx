import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Users, Plus, Shield, Settings, Copy, Check } from 'lucide-react';

export function HouseholdView() {
  const members = useLiveQuery(() => db.members.where({ deleted: false }).toArray());
  const households = useLiveQuery(() => db.households.where({ deleted: false }).toArray());
  
  const [copied, setCopied] = useState(false);

  const activeHousehold = households?.[0];

  const handleCopyCode = () => {
    if (activeHousehold?.inviteCode) {
      navigator.clipboard.writeText(activeHousehold.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-4 pb-24 max-w-2xl mx-auto space-y-6">
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="size-6 text-primary" />
            {activeHousehold?.name || 'My Household'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your family members and settings</p>
        </div>
        <button className="p-2 bg-secondary rounded-full hover:bg-secondary/80 transition-colors">
          <Settings className="size-5" />
        </button>
      </header>

      {/* Invite Code Section */}
      <section className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-1">Family Invite Code</h3>
          <p className="text-lg font-mono font-bold tracking-wider">{activeHousehold?.inviteCode || '------'}</p>
        </div>
        <button 
          onClick={handleCopyCode}
          className="flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          <span className="text-sm font-medium">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </section>

      {/* Members List */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Family Members ({members?.length || 0})</h2>
          <button className="flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80">
            <Plus className="size-4" /> Add
          </button>
        </div>

        <div className="space-y-3">
          {members?.map(member => (
            <div key={member.id} className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl shadow-sm">
              <div 
                className="size-12 rounded-full flex items-center justify-center text-lg font-bold shadow-inner"
                style={{ backgroundColor: member.color, color: 'rgba(0,0,0,0.6)' }}
              >
                {member.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{member.name}</h3>
                  {member.isAdmin && (
                    <span title="Admin" className="bg-blue-100 text-blue-700 p-0.5 rounded-full">
                      <Shield className="size-3" />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium px-2 py-0.5 bg-secondary rounded-md">{member.roleLabel}</span>
                  {member.birthday && <span>• 🎂 {member.birthday}</span>}
                </div>
              </div>
            </div>
          ))}

          {(!members || members.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="size-10 mx-auto mb-3 opacity-20" />
              <p>No members found</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
