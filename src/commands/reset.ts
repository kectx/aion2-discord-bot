import { SlashCommandBuilder, time, TimestampStyles } from "discord.js";
import { getUpcoming } from "../core/schedule-engine.js";
import { listRegions } from "../data/load.js";
import { resolveRegionOrPrompt, sourceLabel } from "../lib/resolve-interaction-region.js";
import type { Command } from "./types.js";

function regionChoices() {
  return listRegions().map((r) => ({ name: r.label, value: r.id }));
}

export const resetCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("reset")
    .setDescription("Show next daily and weekly AION 2 resets")
    .addStringOption((opt) =>
      opt
        .setName("region")
        .setDescription("Override region (affects local display; Global reset is UTC)")
        .setRequired(false)
        .addChoices(...regionChoices()),
    ),

  async execute(interaction) {
    const optionRegion = interaction.options.getString("region");
    const resolved = await resolveRegionOrPrompt(interaction, optionRegion, "reset");
    if (!resolved) return;

    const daily = getUpcoming(resolved.region.id, new Date(), {
      eventIds: ["daily_reset"],
      limit: 1,
    })[0];
    const weekly = getUpcoming(resolved.region.id, new Date(), {
      eventIds: ["weekly_reset"],
      limit: 1,
    })[0];

    const lines = [
      `Resets for **${resolved.region.label}** (via ${sourceLabel(resolved.source)})`,
      daily
        ? `🔄 **Daily** — ${time(daily.startsAt, TimestampStyles.RelativeTime)} (${time(daily.startsAt, TimestampStyles.ShortDateTime)})`
        : "🔄 **Daily** — unknown",
      weekly
        ? `📅 **Weekly** — ${time(weekly.startsAt, TimestampStyles.RelativeTime)} (${time(weekly.startsAt, TimestampStyles.ShortDateTime)})`
        : "📅 **Weekly** — unknown",
    ];

    await interaction.reply({ content: lines.join("\n") });
  },
};

export default resetCommand;
