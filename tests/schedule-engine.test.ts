import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { getUpcoming } from "../src/core/schedule-engine.js";

describe("ScheduleEngine", () => {
  it("finds next Spacetime Rift on EU at 02:00 Berlin time", () => {
    // Monday 2026-10-05 00:30 Europe/Berlin → next rift 02:00
    const now = DateTime.fromObject(
      { year: 2026, month: 10, day: 5, hour: 0, minute: 30 },
      { zone: "Europe/Berlin" },
    );

    const upcoming = getUpcoming("eu", now, {
      eventIds: ["spacetime_rift"],
      limit: 3,
    });

    expect(upcoming.length).toBeGreaterThan(0);
    const next = upcoming[0]!;
    expect(next.eventId).toBe("spacetime_rift");
    expect(next.status).toBe("upcoming");

    const local = DateTime.fromJSDate(next.startsAt).setZone("Europe/Berlin");
    expect(local.hour).toBe(2);
    expect(local.minute).toBe(0);
  });

  it("marks Spacetime Rift active during portal window and exposes phase", () => {
    const now = DateTime.fromObject(
      { year: 2026, month: 10, day: 5, hour: 2, minute: 5 },
      { zone: "Europe/Berlin" },
    );

    const upcoming = getUpcoming("eu", now, {
      eventIds: ["spacetime_rift"],
      limit: 1,
    });

    const current = upcoming[0]!;
    expect(current.status).toBe("active");
    expect(current.phase?.active).toBe(true);
    expect(current.phase?.id).toBe("portal_open");
  });

  it("schedules Shugo Festival every hour at :00", () => {
    const now = DateTime.fromObject(
      { year: 2026, month: 10, day: 5, hour: 14, minute: 12 },
      { zone: "Europe/Berlin" },
    );

    const upcoming = getUpcoming("eu", now, {
      eventIds: ["shugo_festival"],
      limit: 2,
    });

    const next = upcoming[0]!;
    const local = DateTime.fromJSDate(next.startsAt).setZone("Europe/Berlin");
    expect(local.hour).toBe(15);
    expect(local.minute).toBe(0);
  });

  it("schedules Dimensional Invasion at :30", () => {
    const now = DateTime.fromObject(
      { year: 2026, month: 10, day: 5, hour: 14, minute: 12 },
      { zone: "Europe/Berlin" },
    );

    const next = getUpcoming("eu", now, { eventIds: ["dimensional_invasion"], limit: 1 })[0]!;
    const local = DateTime.fromJSDate(next.startsAt).setZone("Europe/Berlin");
    expect(local.minute).toBe(30);
    expect(local.hour).toBe(14);
  });

  it("anchors Global daily reset to 07:00 UTC regardless of region TZ", () => {
    const now = DateTime.fromObject(
      { year: 2026, month: 10, day: 5, hour: 6, minute: 0 },
      { zone: "utc" },
    );

    const na = getUpcoming("na_east", now, { eventIds: ["daily_reset"], limit: 1 })[0]!;
    const eu = getUpcoming("eu", now, { eventIds: ["daily_reset"], limit: 1 })[0]!;

    expect(DateTime.fromJSDate(na.startsAt).toUTC().toISO()).toBe(
      DateTime.fromJSDate(eu.startsAt).toUTC().toISO(),
    );
    expect(DateTime.fromJSDate(na.startsAt).toUTC().hour).toBe(7);
    expect(DateTime.fromJSDate(na.startsAt).toUTC().minute).toBe(0);
  });

  it("schedules weekly reset on Wednesday 07:00 UTC for Global", () => {
    // Tuesday 2026-10-06 12:00 UTC → next weekly Wed 07:00
    const now = DateTime.fromObject(
      { year: 2026, month: 10, day: 6, hour: 12 },
      { zone: "utc" },
    );

    const next = getUpcoming("eu", now, { eventIds: ["weekly_reset"], limit: 1 })[0]!;
    const utc = DateTime.fromJSDate(next.startsAt).toUTC();
    expect(utc.weekday).toBe(3);
    expect(utc.hour).toBe(7);
  });

  it("uses Korea Kaira 4-hour cadence (not Global 3h)", () => {
    const now = DateTime.fromObject(
      { year: 2026, month: 10, day: 5, hour: 1, minute: 0 },
      { zone: "Asia/Seoul" },
    );

    const next = getUpcoming("korea", now, { eventIds: ["watcher_kaira"], limit: 1 })[0]!;
    const local = DateTime.fromJSDate(next.startsAt).setZone("Asia/Seoul");
    // At 01:00, next KR Kaira is 04:00 (hours 0,4,8,...)
    expect(local.hour).toBe(4);
  });

  it("handles NA East DST boundary without shifting server-local hour", () => {
    // US DST ends 2026-11-01 02:00 → clocks fall back. Rift at 02:00 local still 02:00.
    const before = DateTime.fromObject(
      { year: 2026, month: 11, day: 1, hour: 0, minute: 30 },
      { zone: "America/New_York" },
    );
    const next = getUpcoming("na_east", before, { eventIds: ["spacetime_rift"], limit: 1 })[0]!;
    const local = DateTime.fromJSDate(next.startsAt).setZone("America/New_York");
    expect(local.hour).toBe(2);
    expect(local.minute).toBe(0);
  });

  it("lists mixed upcoming events sorted by start time", () => {
    const now = DateTime.fromObject(
      { year: 2026, month: 10, day: 5, hour: 20, minute: 50 },
      { zone: "Europe/Berlin" },
    );

    const list = getUpcoming("eu", now, { limit: 8 });
    expect(list.length).toBeGreaterThan(1);
    for (let i = 1; i < list.length; i++) {
      expect(list[i]!.startsAt.getTime()).toBeGreaterThanOrEqual(list[i - 1]!.startsAt.getTime());
    }
  });
});
