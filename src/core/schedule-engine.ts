import { DateTime } from "luxon";
import { getEventMeta, getScheduleForRegion, getRegion } from "../data/load.js";
import type {
  EventMeta,
  EventOccurrence,
  OccurrencePhase,
  Region,
  ScheduleEvent,
} from "./types.js";

export type GetUpcomingOptions = {
  limit?: number;
  eventIds?: string[];
  /** How far ahead to search (default 7 days). */
  horizonHours?: number;
};

type TimedSlot = {
  eventId: string;
  definition: ScheduleEvent;
  meta: EventMeta;
  startsAt: DateTime;
  endsAt: DateTime;
};

function ensureZone(region: Region): string {
  return region.tz;
}

function toOccurrence(slot: TimedSlot, now: DateTime): EventOccurrence {
  const status = now >= slot.startsAt && now < slot.endsAt ? "active" : "upcoming";
  let phase: OccurrencePhase | null = null;

  if (slot.definition.phases?.length) {
    const first = slot.definition.phases[0];
    if (first) {
      const phaseEnds = slot.startsAt.plus({ minutes: first.minutes });
      phase = {
        id: first.id,
        label: first.label,
        endsAt: phaseEnds.toJSDate(),
        active: now >= slot.startsAt && now < phaseEnds,
      };
    }
  }

  return {
    eventId: slot.eventId,
    meta: slot.meta,
    startsAt: slot.startsAt.toJSDate(),
    endsAt: slot.endsAt.toJSDate(),
    status,
    phase,
  };
}

function collectHourly(
  def: Extract<ScheduleEvent, { kind: "hourly_at_minute" }>,
  meta: EventMeta,
  region: Region,
  from: DateTime,
  to: DateTime,
): TimedSlot[] {
  const slots: TimedSlot[] = [];
  let cursor = from.setZone(ensureZone(region)).startOf("hour");
  // Walk hours covering [from - duration, to]
  cursor = cursor.minus({ hours: 1 });

  while (cursor <= to.plus({ hours: 1 })) {
    const start = cursor.set({ minute: def.minute, second: 0, millisecond: 0 });
    if (start.minute !== def.minute) {
      cursor = cursor.plus({ hours: 1 });
      continue;
    }
    const end = start.plus({ minutes: def.durationMinutes || 1 });
    if (end > from && start < to) {
      slots.push({ eventId: def.eventId, definition: def, meta, startsAt: start, endsAt: end });
    }
    cursor = cursor.plus({ hours: 1 });
  }
  return slots;
}

function collectDailyHours(
  def: Extract<ScheduleEvent, { kind: "daily_hours" }>,
  meta: EventMeta,
  region: Region,
  from: DateTime,
  to: DateTime,
): TimedSlot[] {
  const slots: TimedSlot[] = [];
  const zone = ensureZone(region);
  let day = from.setZone(zone).startOf("day").minus({ days: 1 });
  const lastDay = to.setZone(zone).startOf("day").plus({ days: 1 });

  while (day <= lastDay) {
    for (const hour of def.hours) {
      const start = day.set({ hour, minute: def.minute, second: 0, millisecond: 0 });
      const end = start.plus({ minutes: def.durationMinutes || 1 });
      if (end > from && start < to) {
        slots.push({ eventId: def.eventId, definition: def, meta, startsAt: start, endsAt: end });
      }
    }
    day = day.plus({ days: 1 });
  }
  return slots;
}

function collectWeekly(
  def: Extract<ScheduleEvent, { kind: "weekly_days_hours" }>,
  meta: EventMeta,
  region: Region,
  from: DateTime,
  to: DateTime,
): TimedSlot[] {
  const slots: TimedSlot[] = [];
  const zone = ensureZone(region);
  let day = from.setZone(zone).startOf("day").minus({ days: 1 });
  const lastDay = to.setZone(zone).startOf("day").plus({ days: 8 });

  while (day <= lastDay) {
    const iso = day.weekday; // 1-7 Mon-Sun
    if (def.days.includes(iso)) {
      const start = day.set({
        hour: def.hour,
        minute: def.minute,
        second: 0,
        millisecond: 0,
      });
      const end = start.plus({ minutes: def.durationMinutes || 1 });
      if (end > from && start < to) {
        slots.push({ eventId: def.eventId, definition: def, meta, startsAt: start, endsAt: end });
      }
    }
    day = day.plus({ days: 1 });
  }
  return slots;
}

function collectWindows(
  def: Extract<ScheduleEvent, { kind: "daily_windows" }>,
  meta: EventMeta,
  region: Region,
  from: DateTime,
  to: DateTime,
): TimedSlot[] {
  const slots: TimedSlot[] = [];
  const zone = ensureZone(region);
  let day = from.setZone(zone).startOf("day").minus({ days: 1 });
  const lastDay = to.setZone(zone).startOf("day").plus({ days: 1 });

  while (day <= lastDay) {
    for (const window of def.windows) {
      const start = day.set({
        hour: window.startHour,
        minute: window.startMinute,
        second: 0,
        millisecond: 0,
      });
      let end = day.set({
        hour: window.endHour,
        minute: window.endMinute,
        second: 0,
        millisecond: 0,
      });
      if (end <= start) {
        end = end.plus({ days: 1 });
      }
      if (end > from && start < to) {
        slots.push({ eventId: def.eventId, definition: def, meta, startsAt: start, endsAt: end });
      }
    }
    day = day.plus({ days: 1 });
  }
  return slots;
}

function collectAbsoluteUtc(
  def: Extract<ScheduleEvent, { kind: "absolute_utc" }>,
  meta: EventMeta,
  from: DateTime,
  to: DateTime,
): TimedSlot[] {
  const slots: TimedSlot[] = [];
  let day = from.toUTC().startOf("day").minus({ days: 1 });
  const lastDay = to.toUTC().startOf("day").plus({ days: 8 });

  while (day <= lastDay) {
    const matchesWeekday = def.weekday === undefined || day.weekday === def.weekday;
    if (matchesWeekday) {
      const start = day.set({
        hour: def.hour,
        minute: def.minute,
        second: 0,
        millisecond: 0,
      });
      const duration = def.durationMinutes || 1;
      const end = start.plus({ minutes: duration });
      if (end > from && start < to) {
        slots.push({ eventId: def.eventId, definition: def, meta, startsAt: start, endsAt: end });
      }
    }
    day = day.plus({ days: 1 });
  }
  return slots;
}

function collectSlots(
  def: ScheduleEvent,
  meta: EventMeta,
  region: Region,
  from: DateTime,
  to: DateTime,
): TimedSlot[] {
  switch (def.kind) {
    case "hourly_at_minute":
      return collectHourly(def, meta, region, from, to);
    case "daily_hours":
      return collectDailyHours(def, meta, region, from, to);
    case "weekly_days_hours":
      return collectWeekly(def, meta, region, from, to);
    case "daily_windows":
      return collectWindows(def, meta, region, from, to);
    case "absolute_utc":
      return collectAbsoluteUtc(def, meta, from, to);
    default: {
      const _exhaustive: never = def;
      return _exhaustive;
    }
  }
}

/**
 * Returns the next upcoming/active occurrences for a region, soonest first.
 * Active events (already started, not yet ended) are included and sorted by start time.
 */
export function getUpcoming(
  regionId: string,
  nowInput: Date | DateTime = new Date(),
  options: GetUpcomingOptions = {},
): EventOccurrence[] {
  const region = getRegion(regionId);
  if (!region) {
    throw new Error(`Unknown region: ${regionId}`);
  }

  const limit = options.limit ?? 12;
  const horizonHours = options.horizonHours ?? 24 * 7;
  const now = DateTime.isDateTime(nowInput) ? nowInput : DateTime.fromJSDate(nowInput);
  const from = now;
  const to = now.plus({ hours: horizonHours });

  const schedule = getScheduleForRegion(region);
  const filter = options.eventIds ? new Set(options.eventIds) : null;

  const slots: TimedSlot[] = [];
  for (const def of schedule.events) {
    if (filter && !filter.has(def.eventId)) continue;
    const meta = getEventMeta(def.eventId);
    if (!meta) {
      throw new Error(`Missing event meta for "${def.eventId}"`);
    }
    slots.push(...collectSlots(def, meta, region, from.minus({ hours: 2 }), to));
  }

  // Keep active (started, not ended) and future starts
  const relevant = slots.filter((s) => s.endsAt > now);

  // Deduplicate identical eventId+start
  const seen = new Set<string>();
  const unique = relevant.filter((s) => {
    const key = `${s.eventId}|${s.startsAt.toISO()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => a.startsAt.toMillis() - b.startsAt.toMillis());

  // Prefer one "next" per event for dense hourly events when no filter,
  // but still fill up to limit with soonest overall.
  // For MVP: return soonest across all events (may be many Shugo).
  // When no event filter, skip distant duplicates of the same hourly event beyond first 2.
  const capped: TimedSlot[] = [];
  const perEventCount = new Map<string, number>();
  const maxPerEvent = filter?.size === 1 ? limit : 2;

  for (const slot of unique) {
    const count = perEventCount.get(slot.eventId) ?? 0;
    if (count >= maxPerEvent) continue;
    perEventCount.set(slot.eventId, count + 1);
    capped.push(slot);
    if (capped.length >= limit) break;
  }

  // If we filtered to one event, just take limit soonest
  const resultSlots = filter?.size === 1 ? unique.slice(0, limit) : capped;

  return resultSlots.map((s) => toOccurrence(s, now));
}

export function getScheduleDisclaimer(regionId: string): string {
  const region = getRegion(regionId);
  if (!region) return "";
  return getScheduleForRegion(region).disclaimer;
}
