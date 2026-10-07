import "dotenv/config";
import { REST, Routes } from "discord.js";
import { loadCommands } from "./commands/load-commands.js";
import { loadEnv } from "./lib/env.js";
import { logger } from "./lib/logger.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const commands = await loadCommands();
  const body = [...commands.values()].map((c) => c.data.toJSON());

  const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN);

  if (env.GUILD_ID) {
    logger.info(
      { guildId: env.GUILD_ID, count: body.length },
      "Deploying guild commands (instant)",
    );
    await rest.put(Routes.applicationGuildCommands(env.CLIENT_ID, env.GUILD_ID), { body });
  } else {
    logger.info({ count: body.length }, "Deploying global commands (may take up to ~1h)");
    await rest.put(Routes.applicationCommands(env.CLIENT_ID), { body });
  }

  logger.info("Command deploy complete");
}

main().catch((error: unknown) => {
  logger.error({ err: error }, "Deploy failed");
  process.exit(1);
});
