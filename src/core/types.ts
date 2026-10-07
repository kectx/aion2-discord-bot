import { z } from "zod";

export const ServiceSchema = z.enum(["global", "kr", "tw"]);
export type Service = z.infer<typeof ServiceSchema>;

export const RegionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  service: ServiceSchema,
  tz: z.string().min(1),
  tzConfidence: z.enum(["confirmed", "community_verified", "assumed"]),
  scheduleId: z.string().min(1),
});
export type Region = z.infer<typeof RegionSchema>;

export const EventMetaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().min(1),
  emoji: z.string().min(1),
  description: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
  verifiedAt: z.string().min(1),
  sources: z.array(z.string()).min(1),
});
export type EventMeta = z.infer<typeof EventMetaSchema>;

export const PhaseSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  minutes: z.number().positive(),
});

export const ScheduleEventSchema = z.discriminatedUnion("kind", [
  z.object({
    eventId: z.string().min(1),
    kind: z.literal("hourly_at_minute"),
    minute: z.number().int().min(0).max(59),
    durationMinutes: z.number().nonnegative(),
    phases: z.array(PhaseSchema).optional(),
  }),
  z.object({
    eventId: z.string().min(1),
    kind: z.literal("daily_hours"),
    hours: z.array(z.number().int().min(0).max(23)).min(1),
    minute: z.number().int().min(0).max(59).default(0),
    durationMinutes: z.number().nonnegative(),
    phases: z.array(PhaseSchema).optional(),
  }),
  z.object({
    eventId: z.string().min(1),
    kind: z.literal("weekly_days_hours"),
    /** ISO weekday: 1=Monday … 7=Sunday */
    days: z.array(z.number().int().min(1).max(7)).min(1),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59).default(0),
    durationMinutes: z.number().nonnegative(),
    phases: z.array(PhaseSchema).optional(),
  }),
  z.object({
    eventId: z.string().min(1),
    kind: z.literal("daily_windows"),
    windows: z
      .array(
        z.object({
          startHour: z.number().int().min(0).max(23),
          startMinute: z.number().int().min(0).max(59).default(0),
          endHour: z.number().int().min(0).max(23),
          endMinute: z.number().int().min(0).max(59).default(0),
        }),
      )
      .min(1),
    phases: z.array(PhaseSchema).optional(),
  }),
  z.object({
    eventId: z.string().min(1),
    kind: z.literal("absolute_utc"),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59).default(0),
    /** ISO weekday 1–7; omit for daily */
    weekday: z.number().int().min(1).max(7).optional(),
    durationMinutes: z.number().nonnegative().default(0),
    phases: z.array(PhaseSchema).optional(),
  }),
]);
export type ScheduleEvent = z.infer<typeof ScheduleEventSchema>;

export const ScheduleFileSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  verifiedAt: z.string().min(1),
  disclaimer: z.string().min(1),
  events: z.array(ScheduleEventSchema).min(1),
});
export type ScheduleFile = z.infer<typeof ScheduleFileSchema>;

export type OccurrenceStatus = "upcoming" | "active";

export type OccurrencePhase = {
  id: string;
  label: string;
  endsAt: Date;
  active: boolean;
};

export type EventOccurrence = {
  eventId: string;
  meta: EventMeta;
  startsAt: Date;
  endsAt: Date;
  status: OccurrenceStatus;
  phase: OccurrencePhase | null;
};

export type GuildSettings = {
  guildId: string;
  defaultRegion: string | null;
  updatedAt: string;
};

export type GuildRoleRegion = {
  guildId: string;
  roleId: string;
  regionId: string;
};

export type RegionResolution =
  | { ok: true; region: Region; source: "option" | "role" | "guild_default" }
  | { ok: false; reason: "missing" | "ambiguous_roles"; candidates: Region[] };
