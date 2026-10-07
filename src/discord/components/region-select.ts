import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { listRegions } from "../../data/load.js";

export const REGION_SELECT_CUSTOM_ID = "timer:region-select";

export function buildRegionSelectRow(params?: {
  customId?: string;
  placeholder?: string;
  candidateIds?: string[];
}): ActionRowBuilder<StringSelectMenuBuilder> {
  const customId = params?.customId ?? REGION_SELECT_CUSTOM_ID;
  const placeholder = params?.placeholder ?? "Select your AION 2 region";
  const regions = listRegions().filter((r) =>
    params?.candidateIds ? params.candidateIds.includes(r.id) : true,
  );

  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .addOptions(
      regions.map((region) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(region.label)
          .setDescription(`${region.service.toUpperCase()} · ${region.tz}`)
          .setValue(region.id),
      ),
    );

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}
