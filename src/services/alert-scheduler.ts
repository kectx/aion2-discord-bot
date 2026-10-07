import { time, TimestampStyles, type Client, type TextChannel } from "discord.js";
import { getUpcoming } from "../core/schedule-engine.js";
import { getEventMeta, getRegion } from "../data/load.js";
import { logger } from "../lib/logger.js";
import { getAlertStore } from "../persistence/store.js";

const ALERT_INTERVAL_MS = 30_000;

/** Events that are noisy if alerted hourly — still allowed if user opts in. */
export const NOISY_ALERT_EVENTS = new Set(["shugo_festival", "dimensional_invasion"]);

export function startAlertScheduler(client: Client): () => void {
  const tick = async () => {
    const now = Date.now();
    const alerts = getAlertStore().listAll();

    for (const alert of alerts) {
      try {
        const region = getRegion(alert.regionId);
        const meta = getEventMeta(alert.eventId);
        if (!region || !meta) {
          logger.warn({ alert }, "Alert references unknown region/event — removing");
          getAlertStore().remove(alert.guildId, alert.id);
          continue;
        }

        const upcoming = getUpcoming(region.id, new Date(), {
          eventIds: [alert.eventId],
          limit: 2,
          horizonHours: 48,
        });

        const next = upcoming.find((o) => o.status === "upcoming") ?? upcoming[0];
        if (!next || next.status !== "upcoming") continue;

        const msUntil = next.startsAt.getTime() - now;
        const leadMs = alert.leadMinutes * 60_000;
        // Fire when within lead window, but not more than 90s early past the lead edge
        // (so a 15-min lead fires roughly when T-15 is reached)
        if (msUntil > leadMs || msUntil < -60_000) continue;

        const firedKey = `${alert.eventId}|${next.startsAt.toISOString()}`;
        if (alert.lastFiredKey === firedKey) continue;

        const channel = await client.channels.fetch(alert.channelId).catch(() => null);
        if (!channel || !channel.isTextBased() || channel.isDMBased()) {
          logger.warn({ alert }, "Alert channel unavailable — removing");
          getAlertStore().remove(alert.guildId, alert.id);
          continue;
        }

        const mention = alert.mentionRoleId ? `<@&${alert.mentionRoleId}> ` : "";
        const when = time(next.startsAt, TimestampStyles.RelativeTime);
        const absolute = time(next.startsAt, TimestampStyles.ShortTime);

        await (channel as TextChannel).send({
          content: `${mention}${meta.emoji} **${meta.name}** starts ${when} (${absolute}) · region **${region.label}**`,
          allowedMentions: alert.mentionRoleId
            ? { roles: [alert.mentionRoleId] }
            : { parse: [] },
        });

        getAlertStore().markFired(alert.id, firedKey);
      } catch (error) {
        logger.error({ err: error, alert }, "Failed to process alert");
      }
    }
  };

  void tick();
  const handle = setInterval(() => void tick(), ALERT_INTERVAL_MS);
  handle.unref?.();
  return () => clearInterval(handle);
}
