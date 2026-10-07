import { SlashCommandBuilder, time, TimestampStyles } from "discord.js";
import { getUpcoming } from "../core/schedule-engine.js";
import { getEventMeta, listEventMeta, listRegions } from "../data/load.js";
import { resolveRegionOrPrompt, sourceLabel } from "../lib/resolve-interaction-region.js";
import type { Command } from "./types.js";

function regionChoices() {
  return listRegions().map((r) => ({ name: r.label, value: r.id }));
}

function eventChoices() {
  return listEventMeta().map((e) => ({ name: e.name, value: e.id }));
}

export const nextCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("next")
    .setDescription("Show the next occurrence of an AION 2 event")
    .addStringOption((opt) =>
      opt
        .setName("event")
        .setDescription("Event (default: Spacetime Rift)")
        .setRequired(false)
        .addChoices(...eventChoices()),
    )
    .addStringOption((opt) =>
      opt
        .setName("region")
        .setDescription("Override region")
        .setRequired(false)
        .addChoices(...regionChoices()),
    ),

  async execute(interaction) {
    const eventId = interaction.options.getString("event") ?? "spacetime_rift";
    const optionRegion = interaction.options.getString("region");

    const resolved = await resolveRegionOrPrompt(interaction, optionRegion, "next", eventId);
    if (!resolved) return;

    const meta = getEventMeta(eventId);
    const upcoming = getUpcoming(resolved.region.id, new Date(), {
      eventIds: [eventId],
      limit: 1,
    });
    const next = upcoming[0];
    if (!next || !meta) {
      await interaction.reply({
        content: `No upcoming **${meta?.name ?? eventId}** found.`,
        ephemeral: true,
      });
      return;
    }

    const status =
      next.status === "active"
        ? `**Active** · ends ${time(next.endsAt, TimestampStyles.RelativeTime)}`
        : `${time(next.startsAt, TimestampStyles.RelativeTime)} (${time(next.startsAt, TimestampStyles.ShortDateTime)})`;

    await interaction.reply({
      content: `${meta.emoji} **${meta.name}** — ${status}\nRegion: **${resolved.region.label}** · via ${sourceLabel(resolved.source)}`,
    });
  },
};

export default nextCommand;
