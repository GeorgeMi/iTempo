import {
  addDays,
  addMonths,
  addWeeks,
  isAfter,
  isBefore,
  setHours,
  setMilliseconds,
  setMinutes,
  setSeconds,
  startOfDay,
} from "date-fns";
import type { RecurrenceFrequency } from "./types";

export type RecurringRuleLike = {
  id: string;
  clientId: string;
  serviceId: string;
  frequency: RecurrenceFrequency | string;
  dayOfWeek: number;
  dayOfMonth: number | null;
  startTimeMinutes: number;
  durationMinutes: number;
  price: number;
  startsOn: Date;
  endsOn: Date | null;
  active: boolean;
};

export type AppointmentLike = {
  id: string;
  recurringRuleId: string | null;
  originalStart: Date | null;
  startAt: Date;
  endAt: Date;
  price: number;
  status: string;
  paid: boolean;
  notes?: string | null;
  clientId: string;
  serviceId: string;
};

export type ExpandedOccurrence = {
  kind: "virtual" | "materialized";
  recurringRuleId: string;
  clientId: string;
  serviceId: string;
  startAt: Date;
  endAt: Date;
  price: number;
  originalStart: Date;
  materialized?: AppointmentLike;
};

function atTime(date: Date, minutesFromMidnight: number) {
  const base = setMilliseconds(setSeconds(setMinutes(setHours(date, 0), 0), 0), 0);
  return new Date(base.getTime() + minutesFromMidnight * 60_000);
}

export function occurrencesOf(
  rule: RecurringRuleLike,
  rangeStart: Date,
  rangeEnd: Date,
): Date[] {
  if (!rule.active) return [];
  const slots: Date[] = [];
  const effectiveStart = rule.startsOn > rangeStart ? rule.startsOn : rangeStart;
  const effectiveEnd = rule.endsOn && rule.endsOn < rangeEnd ? rule.endsOn : rangeEnd;
  if (isAfter(effectiveStart, effectiveEnd)) return [];

  if (rule.frequency === "WEEKLY" || rule.frequency === "BIWEEKLY") {
    const step = rule.frequency === "WEEKLY" ? 1 : 2;
    let cursor = startOfDay(rule.startsOn);
    const delta = (rule.dayOfWeek - cursor.getDay() + 7) % 7;
    cursor = addDays(cursor, delta);
    while (isBefore(cursor, startOfDay(effectiveStart))) {
      cursor = addWeeks(cursor, step);
    }
    while (!isAfter(cursor, effectiveEnd)) {
      const slot = atTime(cursor, rule.startTimeMinutes);
      if (!isBefore(slot, effectiveStart) && !isAfter(slot, effectiveEnd)) {
        slots.push(slot);
      }
      cursor = addWeeks(cursor, step);
    }
    return slots;
  }

  if (rule.frequency === "MONTHLY") {
    const dom = rule.dayOfMonth ?? rule.startsOn.getDate();
    let cursor = new Date(rule.startsOn.getFullYear(), rule.startsOn.getMonth(), 1);
    while (isBefore(cursor, new Date(effectiveStart.getFullYear(), effectiveStart.getMonth(), 1))) {
      cursor = addMonths(cursor, 1);
    }
    while (!isAfter(cursor, effectiveEnd)) {
      const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
      const day = Math.min(dom, daysInMonth);
      const dayDate = new Date(cursor.getFullYear(), cursor.getMonth(), day);
      const slot = atTime(dayDate, rule.startTimeMinutes);
      if (!isBefore(slot, effectiveStart) && !isAfter(slot, effectiveEnd)) {
        slots.push(slot);
      }
      cursor = addMonths(cursor, 1);
    }
    return slots;
  }

  return slots;
}

function overlapsRange(a: { startAt: Date; endAt: Date }, from: Date, to: Date) {
  return a.endAt > from && a.startAt <= to;
}

/**
 * Combine recurring rules + materialized appointments into a single ordered list
 * of occurrences within [from, to].
 *
 * Handles:
 *  - virtual slots from rules
 *  - materialized exceptions at their canonical slot (shown at their *actual* time)
 *  - materialized exceptions moved INTO the window from outside (originalStart out of range)
 *  - cancellations: suppress the original slot entirely
 *  - standalone appointments (no rule)
 */
export function expandOccurrences(
  rules: RecurringRuleLike[],
  appointments: AppointmentLike[],
  from: Date,
  to: Date,
): ExpandedOccurrence[] {
  const result: ExpandedOccurrence[] = [];

  // Index exceptions by rule + original slot datetime
  const exceptions = new Map<string, AppointmentLike>();
  for (const a of appointments) {
    if (a.recurringRuleId && a.originalStart) {
      exceptions.set(`${a.recurringRuleId}|${a.originalStart.toISOString()}`, a);
    }
  }
  const consumed = new Set<string>();

  for (const rule of rules) {
    const slots = occurrencesOf(rule, from, to);
    for (const slot of slots) {
      const key = `${rule.id}|${slot.toISOString()}`;
      const mat = exceptions.get(key);
      if (mat) {
        consumed.add(key);
        if (mat.status === "CANCELLED") continue;
        // If the exception was moved outside the window, skip here — it'll be
        // picked up below if its new time intersects the window.
        if (!overlapsRange({ startAt: mat.startAt, endAt: mat.endAt }, from, to)) continue;
        result.push({
          kind: "materialized",
          recurringRuleId: rule.id,
          clientId: mat.clientId,
          serviceId: mat.serviceId,
          startAt: mat.startAt,
          endAt: mat.endAt,
          price: mat.price,
          originalStart: slot,
          materialized: mat,
        });
      } else {
        result.push({
          kind: "virtual",
          recurringRuleId: rule.id,
          clientId: rule.clientId,
          serviceId: rule.serviceId,
          startAt: slot,
          endAt: new Date(slot.getTime() + rule.durationMinutes * 60_000),
          price: rule.price,
          originalStart: slot,
        });
      }
    }
  }

  // Exceptions whose originalStart falls OUTSIDE the window but whose new time
  // intersects the window (moved into view).
  for (const [key, mat] of exceptions) {
    if (consumed.has(key)) continue;
    if (mat.status === "CANCELLED") continue;
    if (!overlapsRange({ startAt: mat.startAt, endAt: mat.endAt }, from, to)) continue;
    const rule = rules.find((r) => r.id === mat.recurringRuleId);
    if (!rule) continue;
    result.push({
      kind: "materialized",
      recurringRuleId: rule.id,
      clientId: mat.clientId,
      serviceId: mat.serviceId,
      startAt: mat.startAt,
      endAt: mat.endAt,
      price: mat.price,
      originalStart: mat.originalStart ?? mat.startAt,
      materialized: mat,
    });
  }

  // Standalone (non-recurring) appointments
  for (const a of appointments) {
    if (a.recurringRuleId) continue;
    if (a.status === "CANCELLED") continue;
    if (!overlapsRange({ startAt: a.startAt, endAt: a.endAt }, from, to)) continue;
    result.push({
      kind: "materialized",
      recurringRuleId: "",
      clientId: a.clientId,
      serviceId: a.serviceId,
      startAt: a.startAt,
      endAt: a.endAt,
      price: a.price,
      originalStart: a.startAt,
      materialized: a,
    });
  }

  result.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  return result;
}
