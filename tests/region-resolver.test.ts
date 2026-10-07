import { describe, expect, it } from "vitest";
import { resolveRegion } from "../src/core/region-resolver.js";

describe("RegionResolver", () => {
  it("prefers slash option over role and guild default", () => {
    const result = resolveRegion({
      optionRegionId: "asia",
      memberRoleIds: ["role-eu"],
      roleMappings: [{ guildId: "g", roleId: "role-eu", regionId: "eu" }],
      guildDefaultRegionId: "na_east",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.region.id).toBe("asia");
      expect(result.source).toBe("option");
    }
  });

  it("uses mapped role when no option", () => {
    const result = resolveRegion({
      memberRoleIds: ["role-latam"],
      roleMappings: [{ guildId: "g", roleId: "role-latam", regionId: "latam" }],
      guildDefaultRegionId: "eu",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.region.id).toBe("latam");
      expect(result.source).toBe("role");
    }
  });

  it("reports ambiguous roles when multiple region maps match", () => {
    const result = resolveRegion({
      memberRoleIds: ["role-eu", "role-asia"],
      roleMappings: [
        { guildId: "g", roleId: "role-eu", regionId: "eu" },
        { guildId: "g", roleId: "role-asia", regionId: "asia" },
      ],
      guildDefaultRegionId: "na_west",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("ambiguous_roles");
      expect(result.candidates.map((c) => c.id).sort()).toEqual(["asia", "eu"]);
    }
  });

  it("falls back to guild default", () => {
    const result = resolveRegion({
      memberRoleIds: [],
      roleMappings: [],
      guildDefaultRegionId: "taiwan",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.region.id).toBe("taiwan");
      expect(result.source).toBe("guild_default");
    }
  });

  it("returns missing when nothing configured", () => {
    const result = resolveRegion({
      memberRoleIds: [],
      roleMappings: [],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("missing");
      expect(result.candidates.length).toBeGreaterThan(0);
    }
  });
});
