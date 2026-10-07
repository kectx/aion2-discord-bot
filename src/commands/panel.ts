import {
  ChannelType,
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { getUpcoming } from "../core/schedule-engine.js";
import { listRegions } from "../data/load.js";
import { buildTimerEmbed } from "../discord/embeds/timer-embed.js";
import { resolveRegionOrPrompt, sourceLabel } from "../lib/resolve-interaction-region.js";
import { getPanelStore } from "../persistence/store.js";
import type { Command } from "./types.js";

function regionChoices() {
  return listRegions().map((r) => ({ name: r.label, value: r.id }));
}

export const panelCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Manage a live auto-updating AION 2 timers board")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Post a live timers panel in this channel (edits itself every minute)")
        .addStringOption((opt) =>
          opt
            .setName("region")
            .setDescription("Region for this panel")
            .setRequired(false)
            .addChoices(...regionChoices()),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("remove").setDescription("Remove the live panel from this channel"),
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List live panels in this server"),
    ),

  async execute(interaction) {
    if (!interaction.guildId || !interaction.channelId) {
      await interaction.reply({ content: "Guild only.", ephemeral: true });
      return;
    }

    const store = getPanelStore();
    const sub = interaction.options.getSubcommand();

    if (sub === "list") {
      const panels = store.listByGuild(interaction.guildId);
      if (panels.length === 0) {
        await interaction.reply({ content: "No live panels configured.", ephemeral: true });
        return;
      }
      await interaction.reply({
        content: panels
          .map((p) => `• <#${p.channelId}> · \`${p.regionId}\` · msg \`${p.messageId}\``)
          .join("\n"),
        ephemeral: true,
      });
      return;
    }

    if (sub === "remove") {
      const removed = store.remove(interaction.guildId, interaction.channelId);
      await interaction.reply({
        content: removed
          ? "Live panel removed from this channel (message left in place — delete manually if needed)."
          : "No live panel in this channel.",
        ephemeral: true,
      });
      return;
    }

    // setup
    if (interaction.channel?.type === ChannelType.GuildVoice) {
      await interaction.reply({
        content: "Use a text channel for the panel.",
        ephemeral: true,
      });
      return;
    }

    const optionRegion = interaction.options.getString("region");
    const resolved = await resolveRegionOrPrompt(interaction, optionRegion, "panel");
    if (!resolved) return;

    const occurrences = getUpcoming(resolved.region.id, new Date(), { limit: 12 });
    const embed = buildTimerEmbed({
      region: resolved.region,
      occurrences,
      sourceLabel: sourceLabel(resolved.source) + " · live panel",
    });

    await interaction.reply({
      content: `Live panel for **${resolved.region.label}** — updates about every minute.`,
      ephemeral: true,
    });

    const channel = interaction.channel;
    if (!channel || !("send" in channel) || typeof channel.send !== "function") {
      await interaction.followUp({
        content: "Cannot post a panel in this channel type.",
        ephemeral: true,
      });
      return;
    }

    const message = await channel.send({ embeds: [embed] });
    store.upsert({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      messageId: message.id,
      regionId: resolved.region.id,
    });
  },
};

export default panelCommand;
