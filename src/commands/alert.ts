import {
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type TextChannel,
} from "discord.js";
import { getEventMeta, listEventMeta, listRegions } from "../data/load.js";
import { resolveRegionOrPrompt } from "../lib/resolve-interaction-region.js";
import { NOISY_ALERT_EVENTS } from "../services/alert-scheduler.js";
import { getAlertStore } from "../persistence/store.js";
import type { Command } from "./types.js";

function regionChoices() {
  return listRegions().map((r) => ({ name: r.label, value: r.id }));
}

function eventChoices() {
  return listEventMeta().map((e) => ({ name: e.name, value: e.id }));
}

/** Matches plain-text or embed alert pings from this bot. */
function looksLikeAlertMessage(message: {
  content: string;
  embeds: ReadonlyArray<{ description?: string | null; footer?: { text?: string | null } | null }>;
}): boolean {
  if (message.content.includes(" starts ") && message.content.includes(" · region ")) {
    return true;
  }
  return message.embeds.some((embed) => {
    const description = embed.description ?? "";
    const footer = embed.footer?.text ?? "";
    return description.startsWith("Starts ") || /T-\d+m/.test(footer);
  });
}

export const alertCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("alert")
    .setDescription("Configure channel pings before AION 2 events")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Ping this channel before an event")
        .addStringOption((opt) =>
          opt
            .setName("event")
            .setDescription("Event to watch")
            .setRequired(true)
            .addChoices(...eventChoices()),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("minutes")
            .setDescription("Minutes before start (default 15)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(180),
        )
        .addStringOption((opt) =>
          opt
            .setName("region")
            .setDescription("Region for this alert")
            .setRequired(false)
            .addChoices(...regionChoices()),
        )
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("Optional role to mention")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove an alert by id (see /alert list)")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("Alert id").setRequired(true).setMinValue(1),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List alerts for this server"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("clear")
        .setDescription(
          "Delete leftover bot alert pings in this channel (does not remove alert configs)",
        )
        .addIntegerOption((opt) =>
          opt
            .setName("limit")
            .setDescription("How many recent messages to scan (default 100, max 200)")
            .setRequired(false)
            .setMinValue(20)
            .setMaxValue(200),
        ),
    ),

  async execute(interaction) {
    if (!interaction.guildId || !interaction.channelId) {
      await interaction.reply({ content: "Guild only.", ephemeral: true });
      return;
    }

    const store = getAlertStore();
    const sub = interaction.options.getSubcommand();

    if (sub === "list") {
      const alerts = store.listByGuild(interaction.guildId);
      if (alerts.length === 0) {
        await interaction.reply({ content: "No alerts configured.", ephemeral: true });
        return;
      }
      const lines = alerts.map((a) => {
        const meta = getEventMeta(a.eventId);
        const role = a.mentionRoleId ? ` · <@&${a.mentionRoleId}>` : "";
        return `\`#${a.id}\` ${meta?.emoji ?? ""} **${meta?.name ?? a.eventId}** · \`${a.regionId}\` · T-${a.leadMinutes}m · <#${a.channelId}>${role}`;
      });
      await interaction.reply({ content: lines.join("\n"), ephemeral: true });
      return;
    }

    if (sub === "remove") {
      const id = interaction.options.getInteger("id", true);
      const removed = store.remove(interaction.guildId, id);
      await interaction.reply({
        content: removed ? `Removed alert \`#${id}\`.` : `No alert \`#${id}\` on this server.`,
        ephemeral: true,
      });
      return;
    }

    if (sub === "clear") {
      const limit = interaction.options.getInteger("limit") ?? 100;
      const channel = interaction.channel;

      if (!channel || !channel.isTextBased() || channel.isDMBased() || !("messages" in channel)) {
        await interaction.reply({
          content: "Use this in a text channel.",
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const textChannel = channel as TextChannel;
      const botId = interaction.client.user?.id;
      if (!botId) {
        await interaction.editReply({ content: "Bot user unavailable." });
        return;
      }

      let deleted = 0;
      const tracked = store.listTrackedMessagesForChannel(
        interaction.guildId,
        interaction.channelId,
      );

      for (const alert of tracked) {
        if (!alert.lastMessageId) continue;
        const msg = await textChannel.messages.fetch(alert.lastMessageId).catch(() => null);
        if (msg) {
          const ok = await msg.delete().then(
            () => true,
            () => false,
          );
          if (ok) deleted += 1;
        }
      }
      store.clearMessagesForChannel(interaction.guildId, interaction.channelId);

      const recent = await textChannel.messages.fetch({ limit });
      for (const message of recent.values()) {
        if (message.author.id !== botId) continue;
        if (!looksLikeAlertMessage(message)) continue;
        const ok = await message.delete().then(
          () => true,
          () => false,
        );
        if (ok) deleted += 1;
      }

      await interaction.editReply({
        content:
          deleted > 0
            ? `Cleared **${deleted}** alert message(s) from this channel. Alert configs are unchanged (\`/alert list\`).`
            : "No leftover alert messages found in this channel (scanned recent history).",
      });
      return;
    }

    // add
    const eventId = interaction.options.getString("event", true);
    const minutes = interaction.options.getInteger("minutes") ?? 15;
    const optionRegion = interaction.options.getString("region");
    const role = interaction.options.getRole("role");

    const resolved = await resolveRegionOrPrompt(
      interaction,
      optionRegion,
      "alert",
      `${eventId}|${minutes}|${role?.id ?? ""}`,
    );
    if (!resolved) return;

    const alert = store.add({
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      regionId: resolved.region.id,
      eventId,
      leadMinutes: minutes,
      mentionRoleId: role?.id ?? null,
    });

    const meta = getEventMeta(eventId);
    const noisy = NOISY_ALERT_EVENTS.has(eventId)
      ? "\nNote: this event is hourly — expect frequent pings."
      : "";

    await interaction.reply({
      content: `Alert \`#${alert.id}\` set: ${meta?.emoji ?? ""} **${meta?.name ?? eventId}** · **${resolved.region.label}** · T-${minutes}m in this channel.${noisy}`,
      ephemeral: true,
    });
  },
};

export default alertCommand;
