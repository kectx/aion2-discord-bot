import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { getUpcoming } from "../core/schedule-engine.js";
import type { Region } from "../core/types.js";
import { getEventMeta, listEventMeta, listRegions } from "../data/load.js";
import { buildTimerEmbed } from "../discord/embeds/timer-embed.js";
import {
  resolveRegionOrPrompt,
  sourceLabel,
  type ResolvedRegionSource,
} from "../lib/resolve-interaction-region.js";
import type { Command } from "./types.js";

function regionChoices() {
  return listRegions().map((r) => ({ name: r.label, value: r.id }));
}

function eventChoices() {
  return listEventMeta().map((e) => ({ name: e.name, value: e.id }));
}

export async function replyWithTimers(
  interaction: ChatInputCommandInteraction,
  region: Region,
  source: ResolvedRegionSource,
  eventId: string | null,
): Promise<void> {
  const occurrences = getUpcoming(region.id, new Date(), {
    limit: eventId ? 8 : 12,
    ...(eventId ? { eventIds: [eventId] } : {}),
  });

  const embed = buildTimerEmbed({
    region,
    occurrences,
    sourceLabel: sourceLabel(source),
    eventFilterLabel: eventId ? (getEventMeta(eventId)?.name ?? eventId) : null,
  });

  const payload = { embeds: [embed], components: [] as never[] };

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(payload);
  } else {
    await interaction.reply(payload);
  }
}

export const timerCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("timer")
    .setDescription("Show countdowns for upcoming AION 2 world events")
    .addStringOption((opt) =>
      opt
        .setName("region")
        .setDescription("Override region for this lookup")
        .setRequired(false)
        .addChoices(...regionChoices()),
    )
    .addStringOption((opt) =>
      opt
        .setName("event")
        .setDescription("Filter to a single event type")
        .setRequired(false)
        .addChoices(...eventChoices()),
    ),

  async execute(interaction) {
    const optionRegion = interaction.options.getString("region");
    const eventId = interaction.options.getString("event");

    const resolved = await resolveRegionOrPrompt(
      interaction,
      optionRegion,
      "timer",
      eventId ?? "",
    );
    if (!resolved) return;

    await replyWithTimers(interaction, resolved.region, resolved.source, eventId);
  },
};

export default timerCommand;
