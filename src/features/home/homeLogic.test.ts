import {
  todaysDoses,
  nextEvent,
  billsDueSoon,
  groceryCount,
  debtSummaryLines,
} from './homeLogic';
import type { Medicine, DoseLog, CalendarEvent, Bill, GroceryItem, Debt } from '../../db/schema';

import { describe, it, expect } from 'vitest';

describe('homeLogic', () => {
  describe('todaysDoses', () => {
    const baseMed: Medicine = {
      id: 'med-1',
      memberId: 'm1',
      name: 'Losartan',
      dosage: '50mg',
      type: 'maintenance',
      timesPerDay: 1,
      scheduledTimes: ['08:00', '20:00'],
      instructions: 'Take with water',
      stock: 10,
      refillThreshold: 3,
      updatedAt: '2026-10-09T00:00:00Z',
      updatedBy: 'm1',
      deleted: false,
    };

    it('returns doses due today with correct statuses', () => {
      const now = new Date(2026, 9, 9, 10, 0, 0);

      const logs: DoseLog[] = [
        {
          id: 'log-1',
          medicineId: 'med-1',
          scheduledAt: '2026-10-09T08:00:00',
          status: 'taken',
          loggedBy: 'm1',
          loggedAt: '2026-10-09T08:05:00',
          updatedAt: '2026-10-09T08:05:00',
          updatedBy: 'm1',
          deleted: false,
        },
      ];

      const doses = todaysDoses([baseMed], logs, now);
      expect(doses).toHaveLength(2);
      expect(doses[0].scheduledTime).toBe('08:00');
      expect(doses[0].status).toBe('taken');
      expect(doses[1].scheduledTime).toBe('20:00');
      expect(doses[1].status).toBe('upcoming');
    });

    it('marks past unlogged doses as missed', () => {
      const now = new Date(2026, 9, 9, 10, 0, 0);
      const doses = todaysDoses([baseMed], [], now);

      expect(doses[0].scheduledTime).toBe('08:00');
      expect(doses[0].status).toBe('missed');
      expect(doses[1].scheduledTime).toBe('20:00');
      expect(doses[1].status).toBe('upcoming');
    });

    it('filters out deleted medicines and deleted logs', () => {
      const now = new Date(2026, 9, 9, 10, 0, 0);
      const deletedMed: Medicine = { ...baseMed, id: 'med-2', deleted: true };
      const doses = todaysDoses([deletedMed], [], now);
      expect(doses).toHaveLength(0);
    });
  });

  describe('nextEvent', () => {
    it('returns the next upcoming event from now', () => {
      const now = new Date(2026, 9, 9, 12, 0, 0);

      const events: CalendarEvent[] = [
        {
          id: 'e1',
          householdId: 'h1',
          title: 'Past Breakfast',
          date: '2026-10-09',
          time: '08:00',
          createdBy: 'm1',
          updatedAt: '2026-10-09',
          updatedBy: 'm1',
          deleted: false,
        },
        {
          id: 'e2',
          householdId: 'h1',
          title: 'Family Dinner',
          date: '2026-10-09',
          time: '18:00',
          createdBy: 'm1',
          updatedAt: '2026-10-09',
          updatedBy: 'm1',
          deleted: false,
        },
        {
          id: 'e3',
          householdId: 'h1',
          title: 'Next Week Checkup',
          date: '2026-10-15',
          time: '10:00',
          createdBy: 'm1',
          updatedAt: '2026-10-09',
          updatedBy: 'm1',
          deleted: false,
        },
      ];

      const next = nextEvent(events, now);
      expect(next?.id).toBe('e2');
      expect(next?.title).toBe('Family Dinner');
    });

    it('returns null if no events or all deleted', () => {
      const now = new Date(2026, 9, 9);
      expect(nextEvent([], now)).toBeNull();
    });
  });

  describe('billsDueSoon', () => {
    it('returns unpaid bills within due horizon', () => {
      const now = new Date(2026, 9, 9);

      const bills: Bill[] = [
        {
          id: 'b1',
          householdId: 'h1',
          name: 'Electricity',
          amount: 245000,
          dueDate: '2026-10-12',
          status: 'unpaid',
          responsibleMemberId: 'm1',
          recurring: true,
          updatedAt: '2026-10-09',
          updatedBy: 'm1',
          deleted: false,
        },
        {
          id: 'b2',
          householdId: 'h1',
          name: 'Water (Paid)',
          amount: 50000,
          dueDate: '2026-10-10',
          status: 'paid',
          responsibleMemberId: 'm1',
          recurring: true,
          updatedAt: '2026-10-09',
          updatedBy: 'm1',
          deleted: false,
        },
      ];

      const soon = billsDueSoon(bills, now, 7);
      expect(soon).toHaveLength(1);
      expect(soon[0].name).toBe('Electricity');
    });
  });

  describe('groceryCount', () => {
    it('counts unchecked non-deleted grocery items', () => {
      const items: GroceryItem[] = [
        {
          id: 'g1',
          householdId: 'h1',
          name: 'Milk',
          category: 'Dairy',
          checked: false,
          addedBy: 'm1',
          updatedAt: '2026-10-09',
          updatedBy: 'm1',
          deleted: false,
        },
        {
          id: 'g2',
          householdId: 'h1',
          name: 'Eggs',
          category: 'Dairy',
          checked: true,
          addedBy: 'm1',
          updatedAt: '2026-10-09',
          updatedBy: 'm1',
          deleted: false,
        },
        {
          id: 'g3',
          householdId: 'h1',
          name: 'Bread',
          category: 'Pantry',
          checked: false,
          addedBy: 'm1',
          updatedAt: '2026-10-09',
          updatedBy: 'm1',
          deleted: true,
        },
      ];

      expect(groceryCount(items)).toBe(1);
    });
  });

  describe('debtSummaryLines', () => {
    it('nets opposite direction debts and formats correctly from viewer perspective', () => {
      const currentMemberId = 'viewer-1';
      const memberNames = {
        'dad-id': 'Dad',
        'kuya-id': 'Kuya',
      };

      const debts: Debt[] = [
        {
          id: 'd1',
          householdId: 'h1',
          fromId: 'viewer-1',
          toId: 'dad-id',
          amount: 20000,
          reason: 'Pizza night',
          settled: false,
          updatedAt: '2026-10-09',
          updatedBy: 'm1',
          deleted: false,
        },
        {
          id: 'd2',
          householdId: 'h1',
          fromId: 'kuya-id',
          toId: 'viewer-1',
          amount: 30000,
          reason: 'Coffee & snacks',
          settled: false,
          updatedAt: '2026-10-09',
          updatedBy: 'm1',
          deleted: false,
        },
        {
          id: 'd3',
          householdId: 'h1',
          fromId: 'viewer-1',
          toId: 'kuya-id',
          amount: 15000,
          reason: 'Gas',
          settled: false,
          updatedAt: '2026-10-09',
          updatedBy: 'm1',
          deleted: false,
        },
      ];

      const lines = debtSummaryLines(debts, currentMemberId, memberNames);
      expect(lines).toHaveLength(2);

      const dadLine = lines.find((l) => l.memberId === 'dad-id');
      expect(dadLine?.text).toBe('You owe Dad ₱200');

      const kuyaLine = lines.find((l) => l.memberId === 'kuya-id');
      expect(kuyaLine?.text).toBe('Kuya owes you ₱150');
    });
  });
});


