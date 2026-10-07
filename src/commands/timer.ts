import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import { resolveRegion } from "../core/region-resolver.js";
import { getUpcoming } from "../core/schedule-engine.js";
import type { Region } from "../core/types.js";
import { listEventMeta, listRegions, getEventMeta, getRegion } from "../data/load.js";
import {
  buildRegionSelectRow,
  REGION_SELECT_CUSTOM_ID,
} from "../discord/components/region-select.js";
import { buildTimerEmbed } from "../discord/embeds/timer-embed.js";
import { getGuildStore } from "../persistence/store.js";
import type { Command } from "./types.js";

function regionChoices() {
  return listRegions().map((r) => ({ name: r.label, value: r.id }));
}

function eventChoices() {
  return listEventMeta().map((e) => ({ name: e.name, value: e.id }));
}

function sourceLabel(source: "option" | "role" | "guild_default" | "select"): string {
  switch (source) {
    case "option":
      return "slash option";
    case "role":
      return "your mapped role";
    case "guild_default":
      return "server default";
    case "select":
      return "manual selection";
  }
}

export async function replyWithTimers(
  interaction: ChatInputCommandInteraction,
  region: Region,
  source: "option" | "role" | "guild_default" | "select",
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

    if (!interaction.guildId) {
      // DMs: region option required
      if (!optionRegion) {
        await interaction.reply({
          content: "In DMs, pass `region:` explicitly (e.g. `/timer region:eu`).",
          ephemeral: true,
        });
        return;
      }
      const region = getRegion(optionRegion);
      if (!region) {
        await interaction.reply({ content: "Unknown region.", ephemeral: true });
        return;
      }
      await replyWithTimers(interaction, region, "option", eventId);
      return;
    }

    const store = getGuildStore();
    const settings = store.getSettings(interaction.guildId);
    const roleMappings = store.listRoleMappings(interaction.guildId);

    const member =
      interaction.member && "roles" in interaction.member
        ? (interaction.member as GuildMember)
        : null;
    const memberRoleIds = member?.roles.cache.map((r) => r.id) ?? [];

    const resolved = resolveRegion({
      optionRegionId: optionRegion,
      memberRoleIds,
      roleMappings,
      guildDefaultRegionId: settings?.defaultRegion ?? null,
    });

    if (resolved.ok) {
      await replyWithTimers(interaction, resolved.region, resolved.source, eventId);
      return;
    }

    const candidateIds = resolved.candidates.map((c) => c.id);
    const message =
      resolved.reason === "ambiguous_roles"
        ? "You have roles mapped to multiple regions. Pick one:"
        : "No region configured for you. Pick one (or ask an admin to set `/config region` / role maps):";

    // Encode event filter in custom id so select handler can recover it
    const customId = eventId
      ? `${REGION_SELECT_CUSTOM_ID}:${eventId}`
      : REGION_SELECT_CUSTOM_ID;

    await interaction.reply({
      content: message,
      components: [buildRegionSelectRow({ customId, candidateIds })],
      ephemeral: true,
    });
  },
};

export default timerCommand;
