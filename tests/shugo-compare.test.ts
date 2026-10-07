import { describe, expect, it } from "vitest";
import {
  ShugoTimersSchema,
  compareWithShugo,
  type LocalSchedule,
} from "../src/sync/shugo-compare.js";

describe("compareWithShugo", () => {
  it("reports matching daily hours as clean (no mismatch)", () => {
    const shugo = ShugoTimersSchema.parse({
      updatedAt: "2026-10-05",
      regions: [{ id: "global-eu", label: "Europe", timeZone: "Europe/Berlin" }],
      events: [
        {
          id: "rift",
          name: "Spacetime Rift",
          durationMinutes: 60,
          portalMinutes: 10,
          schedules: {
            "global-eu": {
              type: "daily",
              times: ["02:00", "05:00", "08:00", "11:00", "14:00", "17:00", "20:00", "23:00"],
            },
          },
        },
      ],
    });

    const schedule: LocalSchedule = {
      id: "global",
      verifiedAt: "2026-10-05",
      events: [
        {
          eventId: "spacetime_rift",
          kind: "daily_hours",
          hours: [2, 5, 8, 11, 14, 17, 20, 23],
          minute: 0,
          durationMinutes: 60,
          phases: [{ minutes: 10 }],
        },
      ],
    };

    const diffs = compareWithShugo({
      shugo,
      regions: [{ id: "eu", tz: "Europe/Berlin", scheduleId: "global" }],
      schedulesById: new Map([["global", schedule]]),
    });

    expect(diffs.filter((d) => d.level === "mismatch")).toEqual([]);
  });

  it("flags hour mismatches", () => {
    const shugo = ShugoTimersSchema.parse({
      updatedAt: "2026-10-05",
      regions: [{ id: "global-eu", label: "Europe", timeZone: "Europe/Berlin" }],
      events: [
        {
          id: "rift",
          name: "Spacetime Rift",
          durationMinutes: 60,
          schedules: {
            "global-eu": { type: "daily", times: ["00:00", "03:00"] },
          },
        },
      ],
    });

    const schedule: LocalSchedule = {
      id: "global",
      verifiedAt: "2026-10-05",
      events: [
        {
          eventId: "spacetime_rift",
          kind: "daily_hours",
          hours: [2, 5],
          minute: 0,
          durationMinutes: 60,
        },
      ],
    };

    const diffs = compareWithShugo({
      shugo,
      regions: [{ id: "eu", tz: "Europe/Berlin", scheduleId: "global" }],
      schedulesById: new Map([["global", schedule]]),
    });

    expect(diffs.some((d) => d.level === "mismatch" && d.scope.includes("hours"))).toBe(true);
  });
});
