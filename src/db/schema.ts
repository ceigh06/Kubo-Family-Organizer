import Dexie, { Table } from 'dexie';

export interface BaseRow { id: string; updatedAt: string; updatedBy: string; deleted: boolean; }
export interface Household extends BaseRow { name: string; inviteCode: string; inviteExpiresAt: string; }
export interface Member extends BaseRow { householdId: string; name: string; photo?: string; contact?: string; birthday?: string; roleLabel: string; color: string; isAdmin: boolean; userId?: string; }
export interface Medicine extends BaseRow { memberId: string; name: string; dosage: string; type: 'maintenance' | 'PRN'; timesPerDay: number; instructions: string; stock: number; refillThreshold: number; }
export interface DoseLog extends BaseRow { medicineId: string; scheduledAt: string; status: 'taken' | 'skipped' | 'snoozed'; loggedBy: string; loggedAt: string; }
export interface GroceryItem extends BaseRow { householdId: string; name: string; category: string; checked: boolean; addedBy: string; }
export interface Bill extends BaseRow { householdId: string; name: string; amount: number; dueDate: string; status: 'paid' | 'unpaid'; responsibleMemberId: string; recurring: boolean; }
export interface Debt extends BaseRow { householdId: string; fromId: string; toId: string; amount: number; reason: string; settled: boolean; }
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
    this.version(2).stores({
      households: 'id, updatedAt',
      members: 'id, householdId, updatedAt',
      medicines: 'id, memberId, updatedAt',
      doseLogs: 'id, medicineId, scheduledAt, updatedAt',
      groceryItems: 'id, householdId, updatedAt',
      bills: 'id, householdId, dueDate, status, updatedAt',
      debts: 'id, householdId, fromId, toId, updatedAt',
      syncQueue: 'id, table, op, createdAt'
    });
  }
}
