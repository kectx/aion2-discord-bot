import {
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { getRegion, listRegions } from "../data/load.js";
import { getGuildStore } from "../persistence/store.js";
import type { Command } from "./types.js";

function regionChoices() {
  return listRegions().map((r) => ({ name: r.label, value: r.id }));
}

export const configCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("Configure AION 2 bot settings for this server")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((sub) =>
      sub
        .setName("region")
        .setDescription("Set or clear the default region for this server")
        .addStringOption((opt) =>
          opt
            .setName("region")
            .setDescription("Default region (omit to clear)")
            .setRequired(false)
            .addChoices(...regionChoices()),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("role-map")
        .setDescription("Map a Discord role to an AION 2 region")
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("Discord role").setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("region")
            .setDescription("AION 2 region for members with this role")
            .setRequired(true)
            .addChoices(...regionChoices()),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("role-unmap")
        .setDescription("Remove a role → region mapping")
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("Discord role").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("show").setDescription("Show current region configuration"),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
      return;
    }

    const store = getGuildStore();
    const sub = interaction.options.getSubcommand();

    if (sub === "region") {
      const regionId = interaction.options.getString("region");
      if (regionId) {
        const region = getRegion(regionId);
        if (!region) {
          await interaction.reply({ content: "Unknown region.", ephemeral: true });
          return;
        }
        store.setDefaultRegion(interaction.guildId, region.id);
        await interaction.reply({
          content: `Default region set to **${region.label}** (\`${region.id}\`).`,
          ephemeral: true,
        });
        return;
      }

      store.setDefaultRegion(interaction.guildId, null);
      await interaction.reply({
        content: "Default region cleared. Members need a mapped role or must pick a region.",
        ephemeral: true,
      });
      return;
    }

    if (sub === "role-map") {
      const role = interaction.options.getRole("role", true);
      const regionId = interaction.options.getString("region", true);
      const region = getRegion(regionId);
      if (!region) {
        await interaction.reply({ content: "Unknown region.", ephemeral: true });
        return;
      }
      store.setRoleMapping(interaction.guildId, role.id, region.id);
      await interaction.reply({
        content: `Mapped <@&${role.id}> → **${region.label}** (\`${region.id}\`).`,
        ephemeral: true,
      });
      return;
    }

    if (sub === "role-unmap") {
      const role = interaction.options.getRole("role", true);
      const removed = store.removeRoleMapping(interaction.guildId, role.id);
      await interaction.reply({
        content: removed
          ? `Removed mapping for <@&${role.id}>.`
          : `No mapping existed for <@&${role.id}>.`,
        ephemeral: true,
      });
      return;
    }

    if (sub === "show") {
      const settings = store.getSettings(interaction.guildId);
      const mappings = store.listRoleMappings(interaction.guildId);
      const defaultLabel = settings?.defaultRegion
        ? (getRegion(settings.defaultRegion)?.label ?? settings.defaultRegion)
        : "*(none)*";

      const mappingLines =
        mappings.length === 0
          ? ["*(none)*"]
          : mappings.map((m) => {
              const region = getRegion(m.regionId);
              return `<@&${m.roleId}> → **${region?.label ?? m.regionId}**`;
            });

      await interaction.reply({
        content: [
          "**Guild configuration**",
          `Default region: ${defaultLabel}`,
          "Role maps:",
          ...mappingLines,
        ].join("\n"),
        ephemeral: true,
      });
    }
  },
};

export default configCommand;
