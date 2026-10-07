import { getDatabase } from "./db.js";
import { GuildSettingsStore } from "./guild-settings.js";
import { AlertStore, PanelStore } from "./panels-alerts.js";

let settingsStore: GuildSettingsStore | null = null;
let panelStore: PanelStore | null = null;
let alertStore: AlertStore | null = null;

export function initGuildStore(databasePath: string): GuildSettingsStore {
  const db = getDatabase(databasePath);
  settingsStore = new GuildSettingsStore(db);
  panelStore = new PanelStore(db);
  alertStore = new AlertStore(db);
  return settingsStore;
}

export function getGuildStore(): GuildSettingsStore {
  if (!settingsStore) {
    throw new Error("Guild settings store not initialized. Call initGuildStore first.");
  }
  return settingsStore;
}

export function getPanelStore(): PanelStore {
  if (!panelStore) {
    throw new Error("Panel store not initialized. Call initGuildStore first.");
  }
  return panelStore;
}

export function getAlertStore(): AlertStore {
  if (!alertStore) {
    throw new Error("Alert store not initialized. Call initGuildStore first.");
  }
  return alertStore;
}
