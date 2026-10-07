import type Database from "better-sqlite3";
import type { GuildRoleRegion, GuildSettings } from "../core/types.js";

export class GuildSettingsStore {
  constructor(private readonly db: Database.Database) {}

  getSettings(guildId: string): GuildSettings | null {
    const row = this.db
      .prepare(
        `SELECT guild_id as guildId, default_region as defaultRegion, updated_at as updatedAt
         FROM guild_settings WHERE guild_id = ?`,
      )
      .get(guildId) as
      | { guildId: string; defaultRegion: string | null; updatedAt: string }
      | undefined;

    if (!row) return null;
    return {
      guildId: row.guildId,
      defaultRegion: row.defaultRegion,
      updatedAt: row.updatedAt,
    };
  }

  setDefaultRegion(guildId: string, regionId: string | null): GuildSettings {
    const updatedAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO guild_settings (guild_id, default_region, updated_at)
         VALUES (@guildId, @defaultRegion, @updatedAt)
         ON CONFLICT(guild_id) DO UPDATE SET
           default_region = excluded.default_region,
           updated_at = excluded.updated_at`,
      )
      .run({ guildId, defaultRegion: regionId, updatedAt });

    return {
      guildId,
      defaultRegion: regionId,
      updatedAt,
    };
  }

  listRoleMappings(guildId: string): GuildRoleRegion[] {
    return this.db
      .prepare(
        `SELECT guild_id as guildId, role_id as roleId, region_id as regionId
         FROM guild_role_regions WHERE guild_id = ?`,
      )
      .all(guildId) as GuildRoleRegion[];
  }

  setRoleMapping(guildId: string, roleId: string, regionId: string): GuildRoleRegion {
    this.db
      .prepare(
        `INSERT INTO guild_role_regions (guild_id, role_id, region_id)
         VALUES (@guildId, @roleId, @regionId)
         ON CONFLICT(guild_id, role_id) DO UPDATE SET
           region_id = excluded.region_id`,
      )
      .run({ guildId, roleId, regionId });

    return { guildId, roleId, regionId };
  }

  removeRoleMapping(guildId: string, roleId: string): boolean {
    const result = this.db
      .prepare(`DELETE FROM guild_role_regions WHERE guild_id = ? AND role_id = ?`)
      .run(guildId, roleId);
    return result.changes > 0;
  }
}
