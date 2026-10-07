import type { Client, TextChannel } from "discord.js";
import { getUpcoming } from "../core/schedule-engine.js";
import { buildTimerEmbed } from "../discord/embeds/timer-embed.js";
import { getRegion } from "../data/load.js";
import { logger } from "../lib/logger.js";
import { getPanelStore } from "../persistence/store.js";

const PANEL_INTERVAL_MS = 60_000;

export function startPanelUpdater(client: Client): () => void {
  const tick = async () => {
    const panels = getPanelStore().listAll();
    for (const panel of panels) {
      try {
        const region = getRegion(panel.regionId);
        if (!region) {
          logger.warn({ panel }, "Panel region missing — removing");
          getPanelStore().remove(panel.guildId, panel.channelId);
          continue;
        }

        const channel = await client.channels.fetch(panel.channelId).catch(() => null);
        if (!channel || !channel.isTextBased() || channel.isDMBased()) {
          logger.warn({ panel }, "Panel channel unavailable — removing");
          getPanelStore().remove(panel.guildId, panel.channelId);
          continue;
        }

        const occurrences = getUpcoming(region.id, new Date(), { limit: 12 });
        const embed = buildTimerEmbed({
          region,
          occurrences,
          sourceLabel: "live panel",
        });

        const textChannel = channel as TextChannel;
        const message = await textChannel.messages.fetch(panel.messageId).catch(() => null);
        if (!message) {
          logger.warn({ panel }, "Panel message missing — removing");
          getPanelStore().remove(panel.guildId, panel.channelId);
          continue;
        }

        await message.edit({ embeds: [embed], content: null });
      } catch (error) {
        logger.error({ err: error, panel }, "Failed to refresh panel");
      }
    }
  };

  void tick();
  const handle = setInterval(() => void tick(), PANEL_INTERVAL_MS);
  handle.unref?.();
  return () => clearInterval(handle);
}
