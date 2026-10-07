import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  type Interaction,
  type StringSelectMenuInteraction,
} from "discord.js";
import { getUpcoming } from "./core/schedule-engine.js";
import { loadCommands } from "./commands/load-commands.js";
import { REGION_SELECT_CUSTOM_ID } from "./discord/components/region-select.js";
import { buildTimerEmbed } from "./discord/embeds/timer-embed.js";
import { getEventMeta, getRegion } from "./data/load.js";
import { logger } from "./lib/logger.js";

export async function createClient(): Promise<Client> {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    partials: [Partials.Channel],
  });

  client.commands = await loadCommands();

  client.once(Events.ClientReady, (readyClient) => {
    logger.info({ tag: readyClient.user.tag, guilds: readyClient.guilds.cache.size }, "Bot ready");
  });

  client.on(Events.InteractionCreate, (interaction) => {
    void handleInteraction(interaction);
  });

  return client;
}

async function handleInteraction(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) {
        logger.warn({ commandName: interaction.commandName }, "Unknown command");
        return;
      }
      await command.execute(interaction);
      return;
    }

    if (
      interaction.isStringSelectMenu() &&
      interaction.customId.startsWith(REGION_SELECT_CUSTOM_ID)
    ) {
      await handleRegionSelect(interaction);
    }
  } catch (error) {
    logger.error({ err: error }, "Interaction handler failed");
    if (!interaction.isRepliable()) return;
    const message = "Something went wrong handling that command.";
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: message, ephemeral: true }).catch(() => undefined);
    } else {
      await interaction.reply({ content: message, ephemeral: true }).catch(() => undefined);
    }
  }
}

async function handleRegionSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const rest = interaction.customId.slice(REGION_SELECT_CUSTOM_ID.length);
  const eventId = rest.startsWith(":") ? rest.slice(1) || null : null;
  const regionId = interaction.values[0];

  await interaction.deferUpdate();

  if (!regionId) {
    await interaction.editReply({ content: "No region selected.", components: [], embeds: [] });
    return;
  }

  const region = getRegion(regionId);
  if (!region) {
    await interaction.editReply({ content: "Unknown region.", components: [], embeds: [] });
    return;
  }

  const occurrences = getUpcoming(region.id, new Date(), {
    limit: eventId ? 8 : 12,
    ...(eventId ? { eventIds: [eventId] } : {}),
  });

  const embed = buildTimerEmbed({
    region,
    occurrences,
    sourceLabel: "manual selection",
    eventFilterLabel: eventId ? (getEventMeta(eventId)?.name ?? eventId) : null,
  });

  await interaction.editReply({ content: null, embeds: [embed], components: [] });
}
