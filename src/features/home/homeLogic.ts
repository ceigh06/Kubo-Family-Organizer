import type { Medicine, DoseLog, CalendarEvent, Bill, GroceryItem, Debt } from '../../db/schema';

export interface DoseWithStatus {
  medicine: Medicine;
  scheduledTime: string; // "HH:MM" e.g. "08:00"
  status: 'taken' | 'skipped' | 'missed' | 'upcoming';
  doseLog?: DoseLog;
}

export interface NextEventResult {
  event: CalendarEvent;
  formattedDate: string;
}

export interface DebtSummaryLine {
  memberId: string;
  text: string;
  netCentavos: number; // positive = they owe you, negative = you owe them
}

function padZero(n: number): string {
  return n.toString().padStart(2, '0');
}

export function formatDateToYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = padZero(date.getMonth() + 1);
  const d = padZero(date.getDate());
  return `${y}-${m}-${d}`;
}

/**
 * Returns the doses due today for active (non-deleted) medicines,
 * calculating each scheduled dose's status (taken, skipped, missed, upcoming).
 */
export function todaysDoses(
  medicines: Medicine[],
  doseLogs: DoseLog[],
  now: Date
): DoseWithStatus[] {
  const todayStr = formatDateToYYYYMMDD(now);
  const nowHours = now.getHours();
  const nowMinutes = now.getMinutes();
  const nowTotalMinutes = nowHours * 60 + nowMinutes;

  const activeMedicines = medicines.filter((m) => !m.deleted);
  const activeLogs = doseLogs.filter((l) => !l.deleted);

  const results: DoseWithStatus[] = [];

  for (const med of activeMedicines) {
    // Determine scheduled times for the medicine
    let times: string[] = [];
    if (med.scheduledTimes && med.scheduledTimes.length > 0) {
      times = med.scheduledTimes;
    } else if (med.timesPerDay && med.timesPerDay > 0) {
      // Default scheduled times fallback
      switch (med.timesPerDay) {
        case 1:
          times = ['08:00'];
          break;
        case 2:
          times = ['08:00', '20:00'];
          break;
        case 3:
          times = ['08:00', '13:00', '20:00'];
          break;
        case 4:
          times = ['08:00', '12:00', '16:00', '20:00'];
          break;
        default:
          times = ['08:00'];
      }
    } else {
      times = ['08:00'];
    }

    for (const timeStr of times) {
      const [hStr, mStr] = timeStr.split(':');
      const h = parseInt(hStr, 10) || 0;
      const m = parseInt(mStr, 10) || 0;
      const schedTotalMinutes = h * 60 + m;

      // Find if there's a log for this medicine on today's date matching this schedule
      const matchingLog = activeLogs.find((log) => {
        if (log.medicineId !== med.id) return false;
        // log.scheduledAt can be an ISO string or YYYY-MM-DDTHH:MM or YYYY-MM-DD
        if (log.scheduledAt.startsWith(todayStr)) {
          // If it contains time, match time if possible
          if (log.scheduledAt.includes('T')) {
            const timePart = log.scheduledAt.split('T')[1]?.slice(0, 5);
            return timePart === timeStr || !timePart;
          }
          return true;
        }
        return false;
      });

      let status: 'taken' | 'skipped' | 'missed' | 'upcoming' = 'upcoming';

      if (matchingLog) {
        if (matchingLog.status === 'taken') {
          status = 'taken';
        } else if (matchingLog.status === 'skipped') {
          status = 'skipped';
        } else if (matchingLog.status === 'missed') {
          status = 'missed';
        } else {
          // If snooze or other, if past time treat as missed/upcoming
          status = schedTotalMinutes < nowTotalMinutes ? 'missed' : 'upcoming';
        }
      } else {
        if (schedTotalMinutes < nowTotalMinutes) {
          status = 'missed';
        } else {
          status = 'upcoming';
        }
      }

      results.push({
        medicine: med,
        scheduledTime: timeStr,
        status,
        doseLog: matchingLog,
      });
    }
  }

  // Sort chronologically by scheduled time
  results.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  return results;
}

/**
 * Finds the next upcoming event from now.
 * Events are checked by date and optional time.
 */
export function nextEvent(events: CalendarEvent[], now: Date): CalendarEvent | null {
  const activeEvents = events.filter((e) => !e.deleted && e.date);
  if (activeEvents.length === 0) return null;

  const nowTime = now.getTime();

  // Helper to parse event date/time to epoch timestamp
  const getEventTime = (e: CalendarEvent): number => {
    if (!e.date) return 0;
    const timePart = e.time ? e.time : '00:00';
    const [h, m] = timePart.split(':').map((x) => parseInt(x, 10) || 0);
    const [year, month, day] = e.date.split('-').map((x) => parseInt(x, 10));
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      const d = new Date(e.date);
      return d.getTime();
    }
    const d = new Date(year, month - 1, day, h, m, 0, 0);
    return d.getTime();
  };

  // We want events that are today or in the future
  // For events today with no time or time in future, or upcoming days
  const upcoming = activeEvents
    .map((e) => ({ event: e, timestamp: getEventTime(e) }))
    .filter((item) => {
      // If event is on same day, consider it upcoming if timestamp >= now or if no specific time set and it's today
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const eventDayStart = new Date(
        new Date(item.timestamp).getFullYear(),
        new Date(item.timestamp).getMonth(),
        new Date(item.timestamp).getDate()
      ).getTime();

      if (eventDayStart > todayStart) return true;
      if (eventDayStart === todayStart) {
        // Same day: if time was not provided or timestamp is >= now
        if (!item.event.time) return true;
        return item.timestamp >= nowTime;
      }
      return false;
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  return upcoming.length > 0 ? upcoming[0].event : null;
}

/**
 * Returns bills due soon (within `days` days from now, default 7), excluding paid.
 */
export function billsDueSoon(bills: Bill[], now: Date, days: number = 7): Bill[] {
  const activeBills = bills.filter((b) => !b.deleted && b.status !== 'paid' && b.dueDate);
  const nowDayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const maxTime = nowDayStart + days * 24 * 60 * 60 * 1000 + (24 * 60 * 60 * 1000 - 1); // end of target day

  return activeBills
    .filter((bill) => {
      const [year, month, day] = bill.dueDate.split('-').map((x) => parseInt(x, 10));
      let billTime: number;
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        billTime = new Date(bill.dueDate).getTime();
      } else {
        billTime = new Date(year, month - 1, day).getTime();
      }
      // Include bills due today or within the next `days` days (and overdue bills if not paid)
      return billTime <= maxTime;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/**
 * Returns the count of unchecked grocery items.
 */
export function groceryCount(items: GroceryItem[]): number {
  return items.filter((item) => !item.deleted && !item.checked).length;
}

export function formatPesoFromCentavos(centavos: number): string {
  const pesos = Math.abs(centavos) / 100;
  return `₱${pesos.toLocaleString('en-PH', {
    minimumFractionDigits: Number.isInteger(pesos) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Computes debt summary lines phrased from the viewer's side:
 * "You owe Dad ₱200", "Kuya owes you ₱150", non-zero balances only,
 * netting opposite-direction entries between currentMember and each peer.
 *
 * `debts`: active debts
 * `currentMemberId`: current viewer's member ID (or 'me')
 * `memberNames`: map of memberId -> member name
 */
export function debtSummaryLines(
  debts: Debt[],
  currentMemberId: string | undefined,
  memberNames: Record<string, string> = {}
): DebtSummaryLine[] {
  if (!currentMemberId) return [];

  const activeDebts = debts.filter((d) => !d.deleted && !d.settled);

  // Map each counterparty memberId to net amount in centavos
  // positive = they owe viewer, negative = viewer owes them
  const balanceMap = new Map<string, number>();

  for (const d of activeDebts) {
    const isViewerPayer = d.fromId === currentMemberId || (currentMemberId === 'me' && d.fromId === 'me');
    const isViewerReceiver = d.toId === currentMemberId || (currentMemberId === 'me' && d.toId === 'me');

    // Convert amount to centavos if amount stored as pesos or centavos
    // Check convention: amounts can be in centavos (e.g. 20000 = ₱200) or pesos (200 = ₱200)
    // The prompt specified "amounts stored in centavos".
    const centavos = d.amount;

    if (isViewerPayer && !isViewerReceiver) {
      // Viewer owes counterparty (d.toId)
      const counterparty = d.toId;
      const current = balanceMap.get(counterparty) ?? 0;
      balanceMap.set(counterparty, current - centavos);
    } else if (isViewerReceiver && !isViewerPayer) {
      // Counterparty (d.fromId) owes viewer
      const counterparty = d.fromId;
      const current = balanceMap.get(counterparty) ?? 0;
      balanceMap.set(counterparty, current + centavos);
    }
  }

  const results: DebtSummaryLine[] = [];

  balanceMap.forEach((netCentavos, counterpartyId) => {
    if (netCentavos === 0) return;

    const name = memberNames[counterpartyId] || counterpartyId;
    const formatted = formatPesoFromCentavos(netCentavos);

    let text = '';
    if (netCentavos < 0) {
      text = `You owe ${name} ${formatted}`;
    } else {
      text = `${name} owes you ${formatted}`;
    }

    results.push({
      memberId: counterpartyId,
      text,
      netCentavos,
    });
  });

  return results;
}
