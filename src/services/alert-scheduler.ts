import {
  EmbedBuilder,
  time,
  TimestampStyles,
  type Client,
  type TextChannel,
} from "discord.js";
import { getUpcoming } from "../core/schedule-engine.js";
import type { EventMeta, Region } from "../core/types.js";
import { getEventMeta, getRegion } from "../data/load.js";
import { logger } from "../lib/logger.js";
import { getAlertStore, getGuildStore } from "../persistence/store.js";

const ALERT_INTERVAL_MS = 30_000;

/** Events that are noisy if alerted hourly — still allowed if user opts in. */
export const NOISY_ALERT_EVENTS = new Set(["shugo_festival", "dimensional_invasion"]);

const ALERT_EMBED_COLOR = 0xe67e22;

export function startAlertScheduler(client: Client): () => void {
  const tick = async () => {
    await cleanupExpiredAlertMessages(client);
    await fireDueAlerts(client);
  };

  void tick();
  const handle = setInterval(() => void tick(), ALERT_INTERVAL_MS);
  handle.unref?.();
  return () => clearInterval(handle);
}

export function buildAlertEmbed(params: {
  meta: EventMeta;
  region: Region;
  startsAt: Date;
  leadMinutes: number;
  showRegion: boolean;
}): EmbedBuilder {
  const { meta, region, startsAt, leadMinutes, showRegion } = params;
  const relative = time(startsAt, TimestampStyles.RelativeTime);
  const absolute = time(startsAt, TimestampStyles.ShortDateTime);

  const embed = new EmbedBuilder()
    .setColor(ALERT_EMBED_COLOR)
    .setTitle(`${meta.emoji} ${meta.name}`)
    .setDescription(`Starts ${relative}\n${absolute}`)
    .setTimestamp(startsAt);

  if (showRegion) {
    embed.setFooter({ text: `${region.label} · T-${leadMinutes}m` });
  } else {
    embed.setFooter({ text: `T-${leadMinutes}m` });
  }

  return embed;
}

/** True when region should appear on the ping (non-default or multi-region guild). */
export function shouldShowRegionOnAlert(
  alertRegionId: string,
  guildDefaultRegionId: string | null | undefined,
  guildAlertRegionIds: readonly string[],
): boolean {
  const uniqueRegions = new Set(guildAlertRegionIds);
  if (uniqueRegions.size > 1) return true;
  if (!guildDefaultRegionId) return false;
  return alertRegionId !== guildDefaultRegionId;
}

async function cleanupExpiredAlertMessages(client: Client): Promise<void> {
  const store = getAlertStore();
  const expired = store.listExpiredMessages(new Date().toISOString());

  for (const alert of expired) {
    if (!alert.lastMessageId) continue;
    try {
      const channel = await client.channels.fetch(alert.channelId).catch(() => null);
      if (channel?.isTextBased() && !channel.isDMBased()) {
        const message = await (channel as TextChannel).messages
          .fetch(alert.lastMessageId)
          .catch(() => null);
        if (message) {
          await message.delete().catch((err: unknown) => {
            logger.warn({ err, alert }, "Could not delete expired alert message");
          });
        }
      }
    } catch (error) {
      logger.warn({ err: error, alert }, "Failed cleaning expired alert message");
    } finally {
      store.clearMessage(alert.id);
    }
  }
}

async function fireDueAlerts(client: Client): Promise<void> {
  const now = Date.now();
  const store = getAlertStore();
  const guildStore = getGuildStore();
  const alerts = store.listAll();

  for (const alert of alerts) {
    try {
      const region = getRegion(alert.regionId);
      const meta = getEventMeta(alert.eventId);
      if (!region || !meta) {
        logger.warn({ alert }, "Alert references unknown region/event — removing");
        store.remove(alert.guildId, alert.id);
        continue;
      }

      const upcoming = getUpcoming(region.id, new Date(), {
        eventIds: [alert.eventId],
        limit: 2,
        horizonHours: 48,
      });

      const next = upcoming.find((o) => o.status === "upcoming");
      if (!next) continue;

      const msUntil = next.startsAt.getTime() - now;
      const leadMs = alert.leadMinutes * 60_000;
      if (msUntil < 0 || msUntil > leadMs) continue;

      const firedKey = `${alert.eventId}|${next.startsAt.toISOString()}`;
      if (alert.lastFiredKey === firedKey) continue;

      const channel = await client.channels.fetch(alert.channelId).catch(() => null);
      if (!channel || !channel.isTextBased() || channel.isDMBased()) {
        logger.warn({ alert }, "Alert channel unavailable — removing");
        store.remove(alert.guildId, alert.id);
        continue;
      }

      if (alert.lastMessageId) {
        const prev = await (channel as TextChannel).messages
          .fetch(alert.lastMessageId)
          .catch(() => null);
        if (prev) {
          await prev.delete().catch(() => undefined);
        }
      }

      const guildAlerts = store.listByGuild(alert.guildId);
      const settings = guildStore.getSettings(alert.guildId);
      const showRegion = shouldShowRegionOnAlert(
        alert.regionId,
        settings?.defaultRegion,
        guildAlerts.map((a) => a.regionId),
      );

      const embed = buildAlertEmbed({
        meta,
        region,
        startsAt: next.startsAt,
        leadMinutes: alert.leadMinutes,
        showRegion,
      });

      const message = await (channel as TextChannel).send({
        ...(alert.mentionRoleId ? { content: `<@&${alert.mentionRoleId}>` } : {}),
        embeds: [embed],
        allowedMentions: alert.mentionRoleId
          ? { roles: [alert.mentionRoleId] }
          : { parse: [] },
      });

      store.markFired(alert.id, firedKey, message.id, next.startsAt.toISOString());
    } catch (error) {
      logger.error({ err: error, alert }, "Failed to process alert");
    }
  }
}
