/**
 * Offline schedule sync-check against Shugo.GG public timers.json.
 * Compare-only — never mutates local data. Exit 1 on mismatches.
 *
 * Usage: npm run sync-check
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  METABOT_EVENTS_URL,
  SHUGO_TIMERS_URL,
  ShugoTimersSchema,
  compareWithShugo,
  type LocalSchedule,
  type SyncDiff,
} from "../src/sync/shugo-compare.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

async function fetchShugo(): Promise<unknown> {
  const res = await fetch(SHUGO_TIMERS_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": "aion2-discord-bot-sync-check/0.1 (+https://github.com/local)",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${SHUGO_TIMERS_URL}: HTTP ${res.status}`);
  }
  return res.json();
}

function printDiffs(diffs: SyncDiff[]): void {
  const counts = { info: 0, warn: 0, mismatch: 0 };
  for (const d of diffs) {
    counts[d.level] += 1;
    const tag = d.level.toUpperCase().padEnd(9);
    console.log(`${tag} [${d.scope}] ${d.message}`);
  }
  console.log("");
  console.log(
    `Summary: ${counts.mismatch} mismatch(es), ${counts.warn} warning(s), ${counts.info} info`,
  );
  console.log(`Manual cross-check: ${METABOT_EVENTS_URL}`);
}

async function main(): Promise<void> {
  console.log(`Fetching ${SHUGO_TIMERS_URL} …`);
  const remoteRaw = await fetchShugo();
  const shugo = ShugoTimersSchema.parse(remoteRaw);

  const regions = (
    readJson(join(ROOT, "data/regions.json")) as Array<{
      id: string;
      tz: string;
      scheduleId: string;
    }>
  ).map((r) => ({ id: r.id, tz: r.tz, scheduleId: r.scheduleId }));

  const schedulesById = new Map<string, LocalSchedule>();
  for (const id of [...new Set(regions.map((r) => r.scheduleId))]) {
    const file = readJson(join(ROOT, "data/schedules", `${id}.json`)) as LocalSchedule;
    schedulesById.set(id, file);
  }

  const diffs = compareWithShugo({ shugo, regions, schedulesById });
  printDiffs(diffs);

  const hard = diffs.some((d) => d.level === "mismatch");
  process.exit(hard ? 1 : 0);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(2);
});
