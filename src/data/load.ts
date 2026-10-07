import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EventMetaSchema,
  RegionSchema,
  ScheduleFileSchema,
  type EventMeta,
  type Region,
  type ScheduleFile,
} from "../core/types.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const DATA_DIR = join(ROOT, "data");

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

const regions = RegionSchema.array().parse(readJson(join(DATA_DIR, "regions.json")));

const eventMetaMap = new Map<string, EventMeta>();
for (const [key, value] of Object.entries(readJson(join(DATA_DIR, "events.meta.json")) as Record<string, unknown>)) {
  const meta = EventMetaSchema.parse(value);
  if (meta.id !== key) {
    throw new Error(`events.meta.json key "${key}" does not match id "${meta.id}"`);
  }
  eventMetaMap.set(meta.id, meta);
}

const scheduleIds = [...new Set(regions.map((r) => r.scheduleId))];
const schedules = new Map<string, ScheduleFile>();
for (const id of scheduleIds) {
  const file = ScheduleFileSchema.parse(readJson(join(DATA_DIR, "schedules", `${id}.json`)));
  if (file.id !== id) {
    throw new Error(`Schedule file id mismatch: expected ${id}, got ${file.id}`);
  }
  for (const event of file.events) {
    if (!eventMetaMap.has(event.eventId)) {
      throw new Error(`Schedule "${id}" references unknown event "${event.eventId}"`);
    }
  }
  schedules.set(id, file);
}

export function listRegions(): readonly Region[] {
  return regions;
}

export function getRegion(id: string): Region | undefined {
  return regions.find((r) => r.id === id);
}

export function getEventMeta(eventId: string): EventMeta | undefined {
  return eventMetaMap.get(eventId);
}

export function listEventMeta(): readonly EventMeta[] {
  return [...eventMetaMap.values()];
}

export function getSchedule(scheduleId: string): ScheduleFile | undefined {
  return schedules.get(scheduleId);
}

export function getScheduleForRegion(region: Region): ScheduleFile {
  const schedule = getSchedule(region.scheduleId);
  if (!schedule) {
    throw new Error(`Missing schedule "${region.scheduleId}" for region "${region.id}"`);
  }
  return schedule;
}
