import { getDatabase } from "./db.js";
import { GuildSettingsStore } from "./guild-settings.js";

let store: GuildSettingsStore | null = null;

export function initGuildStore(databasePath: string): GuildSettingsStore {
  const db = getDatabase(databasePath);
  store = new GuildSettingsStore(db);
  return store;
}

export function getGuildStore(): GuildSettingsStore {
  if (!store) {
    throw new Error("Guild settings store not initialized. Call initGuildStore first.");
  }
  return store;
}
