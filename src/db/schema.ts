import Dexie, { Table } from 'dexie';

export interface Household { id: string; name: string; inviteCode: string; }
export interface Member { id: string; householdId: string; name: string; photo?: string; contact?: string; birthday?: string; roleLabel: string; isAdmin: boolean; }
export interface Medicine { id: string; memberId: string; name: string; dosage: string; type: 'maintenance' | 'PRN'; timesPerDay: number; instructions: string; stock: number; refillThreshold: number; }
export interface DoseLog { id: string; medicineId: string; scheduledAt: string; status: 'taken' | 'skipped' | 'snoozed'; loggedBy: string; loggedAt: string; }
export interface GroceryItem { id: string; householdId: string; name: string; category: string; checked: boolean; addedBy: string; }
export interface Bill { id: string; householdId: string; name: string; amount: number; dueDate: string; status: 'paid' | 'unpaid'; responsibleMemberId: string; recurring: boolean; }
export interface Debt { id: string; householdId: string; fromId: string; toId: string; amount: number; reason: string; settled: boolean; }
export interface SyncQueueItem { id: string; table: string; op: 'create' | 'update' | 'delete'; createdAt: string; }

export class KuboDatabase extends Dexie {
  households!: Table<Household>;
  members!: Table<Member>;
  medicines!: Table<Medicine>;
  doseLogs!: Table<DoseLog>;
  groceryItems!: Table<GroceryItem>;
  bills!: Table<Bill>;
  debts!: Table<Debt>;
  syncQueue!: Table<SyncQueueItem>;

  constructor() {
    super('KuboDatabase');
    this.version(1).stores({
      households: 'id',
      members: 'id, householdId',
      medicines: 'id, memberId',
      doseLogs: 'id, medicineId, scheduledAt',
      groceryItems: 'id, householdId',
      bills: 'id, householdId, dueDate, status',
      debts: 'id, householdId, fromId, toId',
      syncQueue: 'id, table, op, createdAt'
    });
  }
}
