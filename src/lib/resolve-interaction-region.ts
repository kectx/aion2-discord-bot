import {
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import { resolveRegion } from "../core/region-resolver.js";
import type { Region, RegionResolution } from "../core/types.js";
import { getRegion } from "../data/load.js";
import {
  buildRegionSelectRow,
  REGION_SELECT_CUSTOM_ID,
} from "../discord/components/region-select.js";
import { getGuildStore } from "../persistence/store.js";

export type ResolvedRegionSource = "option" | "role" | "guild_default" | "select";

export function sourceLabel(source: ResolvedRegionSource): string {
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

/**
 * Resolve region for a guild slash command, or reply with ephemeral select and return null.
 * `selectPrefix` namespaces the select customId (e.g. "timer", "next", "panel").
 */
export async function resolveRegionOrPrompt(
  interaction: ChatInputCommandInteraction,
  optionRegionId: string | null,
  selectPrefix: string,
  selectPayload = "",
): Promise<{ region: Region; source: ResolvedRegionSource } | null> {
  if (!interaction.guildId) {
    if (!optionRegionId) {
      await interaction.reply({
        content: "In DMs, pass `region:` explicitly.",
        ephemeral: true,
      });
      return null;
    }
    const region = getRegion(optionRegionId);
    if (!region) {
      await interaction.reply({ content: "Unknown region.", ephemeral: true });
      return null;
    }
    return { region, source: "option" };
  }

  const store = getGuildStore();
  const settings = store.getSettings(interaction.guildId);
  const roleMappings = store.listRoleMappings(interaction.guildId);
  const member =
    interaction.member && "roles" in interaction.member
      ? (interaction.member as GuildMember)
      : null;
  const memberRoleIds = member?.roles.cache.map((r) => r.id) ?? [];

  const resolved: RegionResolution = resolveRegion({
    optionRegionId,
    memberRoleIds,
    roleMappings,
    guildDefaultRegionId: settings?.defaultRegion ?? null,
  });

  if (resolved.ok) {
    return { region: resolved.region, source: resolved.source };
  }

  const candidateIds = resolved.candidates.map((c) => c.id);
  const message =
    resolved.reason === "ambiguous_roles"
      ? "You have roles mapped to multiple regions. Pick one:"
      : "No region configured for you. Pick one (or ask an admin to set `/config region` / role maps):";

  const customId = selectPayload
    ? `${REGION_SELECT_CUSTOM_ID}:${selectPrefix}:${selectPayload}`
    : `${REGION_SELECT_CUSTOM_ID}:${selectPrefix}`;

  await interaction.reply({
    content: message,
    components: [buildRegionSelectRow({ customId, candidateIds })],
    ephemeral: true,
  });
  return null;
}

export function parseRegionSelectCustomId(customId: string): {
  prefix: string;
  payload: string;
} | null {
  if (!customId.startsWith(REGION_SELECT_CUSTOM_ID)) return null;
  const rest = customId.slice(REGION_SELECT_CUSTOM_ID.length);
  if (!rest.startsWith(":")) return { prefix: "timer", payload: "" };
  const parts = rest.slice(1).split(":");
  const prefix = parts[0] ?? "timer";
  const payload = parts.slice(1).join(":");
  return { prefix, payload };
}
