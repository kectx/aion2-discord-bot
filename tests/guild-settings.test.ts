import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { closeDatabase, getDatabase } from "../src/persistence/db.js";
import { GuildSettingsStore } from "../src/persistence/guild-settings.js";

describe("GuildSettingsStore", () => {
  const dirs: string[] = [];

  afterEach(() => {
    closeDatabase();
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("persists default region and role mappings", () => {
    const dir = mkdtempSync(join(tmpdir(), "aion2-bot-"));
    dirs.push(dir);
    const db = getDatabase(join(dir, "test.sqlite"));
    const store = new GuildSettingsStore(db);

    store.setDefaultRegion("guild-1", "eu");
    expect(store.getSettings("guild-1")?.defaultRegion).toBe("eu");

    store.setRoleMapping("guild-1", "role-1", "asia");
    expect(store.listRoleMappings("guild-1")).toEqual([
      { guildId: "guild-1", roleId: "role-1", regionId: "asia" },
    ]);

    expect(store.removeRoleMapping("guild-1", "role-1")).toBe(true);
    expect(store.listRoleMappings("guild-1")).toEqual([]);

    store.setDefaultRegion("guild-1", null);
    expect(store.getSettings("guild-1")?.defaultRegion).toBeNull();
  });
});
