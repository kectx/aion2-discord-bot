import type Database from "better-sqlite3";

export type GuildPanel = {
  guildId: string;
  channelId: string;
  messageId: string;
  regionId: string;
  updatedAt: string;
};

export type GuildAlert = {
  id: number;
  guildId: string;
  channelId: string;
  regionId: string;
  eventId: string;
  leadMinutes: number;
  mentionRoleId: string | null;
  lastFiredKey: string | null;
  createdAt: string;
};

export class PanelStore {
  constructor(private readonly db: Database.Database) {}

  upsert(panel: Omit<GuildPanel, "updatedAt">): GuildPanel {
    const updatedAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO guild_panels (guild_id, channel_id, message_id, region_id, updated_at)
         VALUES (@guildId, @channelId, @messageId, @regionId, @updatedAt)
         ON CONFLICT(guild_id, channel_id) DO UPDATE SET
           message_id = excluded.message_id,
           region_id = excluded.region_id,
           updated_at = excluded.updated_at`,
      )
      .run({ ...panel, updatedAt });
    return { ...panel, updatedAt };
  }

  get(guildId: string, channelId: string): GuildPanel | null {
    const row = this.db
      .prepare(
        `SELECT guild_id as guildId, channel_id as channelId, message_id as messageId,
                region_id as regionId, updated_at as updatedAt
         FROM guild_panels WHERE guild_id = ? AND channel_id = ?`,
      )
      .get(guildId, channelId) as GuildPanel | undefined;
    return row ?? null;
  }

  listByGuild(guildId: string): GuildPanel[] {
    return this.db
      .prepare(
        `SELECT guild_id as guildId, channel_id as channelId, message_id as messageId,
                region_id as regionId, updated_at as updatedAt
         FROM guild_panels WHERE guild_id = ?`,
      )
      .all(guildId) as GuildPanel[];
  }

  listAll(): GuildPanel[] {
    return this.db
      .prepare(
        `SELECT guild_id as guildId, channel_id as channelId, message_id as messageId,
                region_id as regionId, updated_at as updatedAt
         FROM guild_panels`,
      )
      .all() as GuildPanel[];
  }

  remove(guildId: string, channelId: string): boolean {
    const result = this.db
      .prepare(`DELETE FROM guild_panels WHERE guild_id = ? AND channel_id = ?`)
      .run(guildId, channelId);
    return result.changes > 0;
  }
}

export class AlertStore {
  constructor(private readonly db: Database.Database) {}

  add(input: {
    guildId: string;
    channelId: string;
    regionId: string;
    eventId: string;
    leadMinutes: number;
    mentionRoleId?: string | null;
  }): GuildAlert {
    const createdAt = new Date().toISOString();
    const result = this.db
      .prepare(
        `INSERT INTO guild_alerts
          (guild_id, channel_id, region_id, event_id, lead_minutes, mention_role_id, last_fired_key, created_at)
         VALUES (@guildId, @channelId, @regionId, @eventId, @leadMinutes, @mentionRoleId, NULL, @createdAt)`,
      )
      .run({
        guildId: input.guildId,
        channelId: input.channelId,
        regionId: input.regionId,
        eventId: input.eventId,
        leadMinutes: input.leadMinutes,
        mentionRoleId: input.mentionRoleId ?? null,
        createdAt,
      });

    return {
      id: Number(result.lastInsertRowid),
      guildId: input.guildId,
      channelId: input.channelId,
      regionId: input.regionId,
      eventId: input.eventId,
      leadMinutes: input.leadMinutes,
      mentionRoleId: input.mentionRoleId ?? null,
      lastFiredKey: null,
      createdAt,
    };
  }

  listByGuild(guildId: string): GuildAlert[] {
    return this.db
      .prepare(
        `SELECT id, guild_id as guildId, channel_id as channelId, region_id as regionId,
                event_id as eventId, lead_minutes as leadMinutes,
                mention_role_id as mentionRoleId, last_fired_key as lastFiredKey,
                created_at as createdAt
         FROM guild_alerts WHERE guild_id = ? ORDER BY id`,
      )
      .all(guildId) as GuildAlert[];
  }

  listAll(): GuildAlert[] {
    return this.db
      .prepare(
        `SELECT id, guild_id as guildId, channel_id as channelId, region_id as regionId,
                event_id as eventId, lead_minutes as leadMinutes,
                mention_role_id as mentionRoleId, last_fired_key as lastFiredKey,
                created_at as createdAt
         FROM guild_alerts ORDER BY id`,
      )
      .all() as GuildAlert[];
  }

  remove(guildId: string, id: number): boolean {
    const result = this.db
      .prepare(`DELETE FROM guild_alerts WHERE guild_id = ? AND id = ?`)
      .run(guildId, id);
    return result.changes > 0;
  }

  markFired(id: number, firedKey: string): void {
    this.db
      .prepare(`UPDATE guild_alerts SET last_fired_key = ? WHERE id = ?`)
      .run(firedKey, id);
  }
}
