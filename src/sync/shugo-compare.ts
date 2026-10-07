import { z } from "zod";

const ShugoScheduleSchema = z.object({
  type: z.string(),
  times: z.array(z.string()).optional(),
  minute: z.number().optional(),
  days: z.array(z.string()).optional(),
  timeLabels: z.array(z.string()).optional(),
  weekday: z.string().optional(),
  time: z.string().optional(),
  utc: z.boolean().optional(),
});

export const ShugoTimersSchema = z.object({
  updatedAt: z.string(),
  regions: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      timeZone: z.string(),
      note: z.string().optional(),
    }),
  ),
  events: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      durationMinutes: z.number().optional(),
      portalMinutes: z.number().optional(),
      schedules: z.record(z.string(), ShugoScheduleSchema),
    }),
  ),
});

export type ShugoTimers = z.infer<typeof ShugoTimersSchema>;

/** Our region id → Shugo region id */
export const REGION_TO_SHUGO: Record<string, string> = {
  na_east: "global-nae",
  na_west: "global-naw",
  eu: "global-eu",
  latam: "global-sa",
  asia: "global-as",
  korea: "kr",
  taiwan: "tw",
};

/** Our event id → Shugo event id */
export const EVENT_TO_SHUGO: Record<string, string> = {
  spacetime_rift: "rift",
  shugo_festival: "shugo-festival",
  dimensional_invasion: "dimensional-invasion",
  artifact_siege: "artifact-siege",
  executor_bosses: "siege-bosses",
  guardian_nahma: "guardian-nahma",
  watcher_kaira: "watcher-kaira",
  daily_reset: "daily-reset",
  weekly_reset: "weekly-reset",
};

const DAY_TO_ISO: Record<string, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 7,
};

export type SyncDiff = {
  level: "info" | "warn" | "mismatch";
  scope: string;
  message: string;
};

function parseHm(time: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return null;
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

function sortedEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  const as = [...a].sort();
  const bs = [...b].sort();
  return as.every((v, i) => v === bs[i]);
}

export type LocalRegion = {
  id: string;
  tz: string;
  scheduleId: string;
};

export type LocalScheduleEvent = {
  eventId: string;
  kind: string;
  hours?: number[];
  minute?: number;
  days?: number[];
  hour?: number;
  durationMinutes?: number;
  phases?: { minutes: number }[];
  windows?: {
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
  }[];
  weekday?: number;
};

export type LocalSchedule = {
  id: string;
  verifiedAt: string;
  events: LocalScheduleEvent[];
};

/**
 * Compare local schedule data against Shugo.GG public timers.json.
 * Does not mutate data — reports diffs only.
 */
export function compareWithShugo(params: {
  shugo: ShugoTimers;
  regions: LocalRegion[];
  schedulesById: Map<string, LocalSchedule>;
}): SyncDiff[] {
  const { shugo, regions, schedulesById } = params;
  const diffs: SyncDiff[] = [];

  diffs.push({
    level: "info",
    scope: "shugo",
    message: `Remote updatedAt=${shugo.updatedAt} · events=${shugo.events.length} · regions=${shugo.regions.length}`,
  });

  for (const region of regions) {
    const shugoRegionId = REGION_TO_SHUGO[region.id];
    if (!shugoRegionId) {
      diffs.push({
        level: "warn",
        scope: `region:${region.id}`,
        message: "No Shugo region mapping",
      });
      continue;
    }

    const remoteRegion = shugo.regions.find((r) => r.id === shugoRegionId);
    if (!remoteRegion) {
      diffs.push({
        level: "mismatch",
        scope: `region:${region.id}`,
        message: `Shugo region "${shugoRegionId}" missing remotely`,
      });
      continue;
    }

    if (remoteRegion.timeZone !== region.tz) {
      diffs.push({
        level: "mismatch",
        scope: `region:${region.id}.tz`,
        message: `local=${region.tz} shugo=${remoteRegion.timeZone}`,
      });
    }
  }

  // Compare each unique schedule file using a representative Shugo region
  const scheduleRepRegion: Record<string, string> = {
    global: "eu",
    korea: "korea",
    taiwan: "taiwan",
  };

  for (const [scheduleId, localSchedule] of schedulesById) {
    const repLocalRegionId = scheduleRepRegion[scheduleId];
    if (!repLocalRegionId) continue;
    const shugoRegionId = REGION_TO_SHUGO[repLocalRegionId];
    if (!shugoRegionId) continue;

    for (const localEvent of localSchedule.events) {
      const shugoEventId = EVENT_TO_SHUGO[localEvent.eventId];
      if (!shugoEventId) {
        if (localEvent.eventId === "arena_of_tactics") {
          diffs.push({
            level: "info",
            scope: `${scheduleId}:${localEvent.eventId}`,
            message: "Not present in Shugo timers.json (local-only / MetaBot)",
          });
        }
        continue;
      }

      const remoteEvent = shugo.events.find((e) => e.id === shugoEventId);
      if (!remoteEvent) {
        diffs.push({
          level: "mismatch",
          scope: `${scheduleId}:${localEvent.eventId}`,
          message: `Shugo event "${shugoEventId}" missing`,
        });
        continue;
      }

      const remoteSched = remoteEvent.schedules[shugoRegionId];
      if (!remoteSched) {
        diffs.push({
          level: "mismatch",
          scope: `${scheduleId}:${localEvent.eventId}`,
          message: `No Shugo schedule for region ${shugoRegionId}`,
        });
        continue;
      }

      if (
        remoteEvent.durationMinutes !== undefined &&
        localEvent.durationMinutes !== undefined &&
        remoteEvent.durationMinutes !== localEvent.durationMinutes &&
        localEvent.durationMinutes !== 0
      ) {
        diffs.push({
          level: "warn",
          scope: `${scheduleId}:${localEvent.eventId}.duration`,
          message: `local=${localEvent.durationMinutes}m shugo=${remoteEvent.durationMinutes}m`,
        });
      }

      if (
        remoteEvent.portalMinutes !== undefined &&
        localEvent.phases?.[0]?.minutes !== undefined &&
        remoteEvent.portalMinutes !== localEvent.phases[0].minutes
      ) {
        diffs.push({
          level: "mismatch",
          scope: `${scheduleId}:${localEvent.eventId}.portal`,
          message: `local=${localEvent.phases[0].minutes}m shugo=${remoteEvent.portalMinutes}m`,
        });
      }

      compareScheduleShape(diffs, `${scheduleId}:${localEvent.eventId}`, localEvent, remoteSched);
    }
  }

  return diffs;
}

function compareScheduleShape(
  diffs: SyncDiff[],
  scope: string,
  local: LocalScheduleEvent,
  remote: z.infer<typeof ShugoScheduleSchema>,
): void {
  if (remote.type === "hourly" && local.kind === "hourly_at_minute") {
    if (remote.minute !== local.minute) {
      diffs.push({
        level: "mismatch",
        scope: `${scope}.minute`,
        message: `local=${local.minute} shugo=${remote.minute}`,
      });
    }
    return;
  }

  if (remote.type === "daily" && local.kind === "daily_hours") {
    const remoteHours = (remote.times ?? [])
      .map(parseHm)
      .filter((x): x is { hour: number; minute: number } => x !== null)
      .map((x) => x.hour);
    const localHours = local.hours ?? [];
    if (!sortedEqual(remoteHours, localHours)) {
      diffs.push({
        level: "mismatch",
        scope: `${scope}.hours`,
        message: `local=[${localHours.join(",")}] shugo=[${remoteHours.join(",")}]`,
      });
    }
    return;
  }

  if (remote.type === "weekly" && local.kind === "weekly_days_hours") {
    const remoteDays = (remote.days ?? [])
      .map((d) => DAY_TO_ISO[d.toLowerCase()])
      .filter((n): n is number => typeof n === "number");
    const localDays = local.days ?? [];
    if (!sortedEqual(remoteDays, localDays)) {
      diffs.push({
        level: "mismatch",
        scope: `${scope}.days`,
        message: `local=[${localDays.join(",")}] shugo=[${remoteDays.join(",")}]`,
      });
    }

    const remoteTimes = (remote.times ?? [])
      .map(parseHm)
      .filter((x): x is { hour: number; minute: number } => x !== null);

    // KR may have multiple group times — compare first slot to our single time, warn on multi
    if (remoteTimes.length > 1) {
      diffs.push({
        level: "warn",
        scope: `${scope}.times`,
        message: `Shugo has ${remoteTimes.length} group times [${(remote.times ?? []).join(", ")}] vs local single ${local.hour}:${String(local.minute ?? 0).padStart(2, "0")}`,
      });
    } else if (remoteTimes[0]) {
      if (remoteTimes[0].hour !== local.hour || remoteTimes[0].minute !== (local.minute ?? 0)) {
        diffs.push({
          level: "mismatch",
          scope: `${scope}.time`,
          message: `local=${local.hour}:${String(local.minute ?? 0).padStart(2, "0")} shugo=${remote.times?.[0]}`,
        });
      }
    }
    return;
  }

  if (remote.type === "daily" && local.kind === "absolute_utc") {
    // Shugo may encode Global resets as 16:00 Asia/Seoul (= 07:00 UTC)
    diffs.push({
      level: "info",
      scope: `${scope}`,
      message: `Local uses absolute_utc; Shugo type=${remote.type} times=${(remote.times ?? []).join(",") || remote.time || "?"}`,
    });
    return;
  }

  if (remote.type === "weekly" && local.kind === "absolute_utc") {
    diffs.push({
      level: "info",
      scope: `${scope}`,
      message: `Local uses absolute_utc; Shugo weekly ${ (remote.days ?? []).join(",") } ${(remote.times ?? []).join(",")}`,
    });
    return;
  }

  if (remote.utc && local.kind === "absolute_utc") {
    const hm = remote.time ? parseHm(remote.time) : null;
    if (hm && (hm.hour !== local.hour || hm.minute !== (local.minute ?? 0))) {
      diffs.push({
        level: "mismatch",
        scope: `${scope}.utc`,
        message: `local=${local.hour}:${String(local.minute ?? 0).padStart(2, "0")} UTC shugo=${remote.time} UTC`,
      });
    }
    return;
  }

  diffs.push({
    level: "warn",
    scope,
    message: `Uncompared shapes local.kind=${local.kind} shugo.type=${remote.type}`,
  });
}

export const SHUGO_TIMERS_URL = "https://shugo.gg/timers.json";
export const METABOT_EVENTS_URL = "https://metabot.gg/en/aion-2/events";
