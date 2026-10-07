import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Collection } from "discord.js";
import type { Command } from "./types.js";

const COMMANDS_DIR = dirname(fileURLToPath(import.meta.url));

function isCommand(value: unknown): value is Command {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Command>;
  return (
    typeof candidate.data === "object" &&
    candidate.data !== null &&
    "name" in candidate.data &&
    typeof candidate.execute === "function"
  );
}

export async function loadCommands(): Promise<Collection<string, Command>> {
  const collection = new Collection<string, Command>();
  const files = (await readdir(COMMANDS_DIR)).filter(
    (f) => f.endsWith(".ts") || f.endsWith(".js"),
  );

  const skip = new Set([
    "types.ts",
    "types.js",
    "load-commands.ts",
    "load-commands.js",
  ]);

  for (const file of files) {
    if (skip.has(file) || file.startsWith("index.")) {
      continue;
    }

    const mod = (await import(pathToFileURL(join(COMMANDS_DIR, file)).href)) as {
      default?: unknown;
    };
    const command = mod.default;
    if (!isCommand(command)) {
      throw new Error(`Command file ${file} does not export a valid Command default`);
    }
    collection.set(command.data.name, command);
  }

  return collection;
}
