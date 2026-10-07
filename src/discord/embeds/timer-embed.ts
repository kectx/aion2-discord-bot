import { EmbedBuilder, time, TimestampStyles } from "discord.js";
import type { EventOccurrence, Region } from "../../core/types.js";
import { getScheduleDisclaimer } from "../../core/schedule-engine.js";

function formatOccurrence(occ: EventOccurrence): string {
  const absolute = time(occ.startsAt, TimestampStyles.ShortTime);
  const relative = time(occ.startsAt, TimestampStyles.RelativeTime);

  if (occ.status === "active") {
    const ends = time(occ.endsAt, TimestampStyles.RelativeTime);
    let phase = "";
    if (occ.phase?.active) {
      phase = ` · ${occ.phase.label} until ${time(occ.phase.endsAt, TimestampStyles.RelativeTime)}`;
    }
    return `${occ.meta.emoji} **${occ.meta.name}** — **Active** · ends ${ends}${phase}`;
  }

  let phase = "";
  if (occ.phase) {
    const mins = Math.round((occ.phase.endsAt.getTime() - occ.startsAt.getTime()) / 60_000);
    phase = ` · ${occ.phase.label} ${mins}m`;
  }

  return `${occ.meta.emoji} **${occ.meta.name}** — ${relative} (${absolute})${phase}`;
}

export function buildTimerEmbed(params: {
  region: Region;
  occurrences: EventOccurrence[];
  sourceLabel: string;
  eventFilterLabel?: string | null;
}): EmbedBuilder {
  const { region, occurrences, sourceLabel, eventFilterLabel } = params;
  const disclaimer = getScheduleDisclaimer(region.id);

  const lines =
    occurrences.length === 0
      ? ["No upcoming events in the search window."]
      : occurrences.map(formatOccurrence);

  const title = eventFilterLabel
    ? `AION 2 Timers — ${eventFilterLabel}`
    : "AION 2 Timers — upcoming";

  const footer =
    disclaimer.length > 180 ? `${disclaimer.slice(0, 177)}…` : disclaimer;

  return new EmbedBuilder()
    .setColor(0x2b6cb0)
    .setTitle(title)
    .setDescription(lines.join("\n"))
    .addFields(
      {
        name: "Region",
        value: `${region.label} (\`${region.id}\`) · TZ \`${region.tz}\` · ${region.tzConfidence}`,
        inline: false,
      },
      {
        name: "Resolved via",
        value: sourceLabel,
        inline: true,
      },
    )
    .setFooter({ text: footer })
    .setTimestamp(new Date());
}
