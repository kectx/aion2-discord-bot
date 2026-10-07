import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

let db: Database.Database | null = null;

export function getDatabase(path: string): Database.Database {
  if (db) return db;

  mkdirSync(dirname(path), { recursive: true });
  db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY NOT NULL,
      default_region TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS guild_role_regions (
      guild_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      region_id TEXT NOT NULL,
      PRIMARY KEY (guild_id, role_id)
    );

    CREATE INDEX IF NOT EXISTS idx_guild_role_regions_guild
      ON guild_role_regions (guild_id);
  `);
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
