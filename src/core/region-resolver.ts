import { getRegion, listRegions } from "../data/load.js";
import type { GuildRoleRegion, Region, RegionResolution } from "./types.js";

export type RegionResolverInput = {
  optionRegionId?: string | null;
  memberRoleIds: readonly string[];
  roleMappings: readonly GuildRoleRegion[];
  guildDefaultRegionId?: string | null;
};

/**
 * Resolve region in priority order:
 * 1. explicit slash option
 * 2. mapped Discord roles on the member (ambiguous if multiple distinct regions)
 * 3. guild default region
 * 4. missing → caller shows select menu
 */
export function resolveRegion(input: RegionResolverInput): RegionResolution {
  const all = listRegions();

  if (input.optionRegionId) {
    const region = getRegion(input.optionRegionId);
    if (!region) {
      return { ok: false, reason: "missing", candidates: [...all] };
    }
    return { ok: true, region, source: "option" };
  }

  const roleSet = new Set(input.memberRoleIds);
  const matchedRegionIds = [
    ...new Set(
      input.roleMappings
        .filter((m) => roleSet.has(m.roleId))
        .map((m) => m.regionId),
    ),
  ];

  if (matchedRegionIds.length === 1) {
    const regionId = matchedRegionIds[0]!;
    const region = getRegion(regionId);
    if (region) {
      return { ok: true, region, source: "role" };
    }
  }

  if (matchedRegionIds.length > 1) {
    const candidates = matchedRegionIds
      .map((id) => getRegion(id))
      .filter((r): r is Region => Boolean(r));
    return { ok: false, reason: "ambiguous_roles", candidates };
  }

  if (input.guildDefaultRegionId) {
    const region = getRegion(input.guildDefaultRegionId);
    if (region) {
      return { ok: true, region, source: "guild_default" };
    }
  }

  return { ok: false, reason: "missing", candidates: [...all] };
}
