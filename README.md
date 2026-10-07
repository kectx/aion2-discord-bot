# AION 2 Discord Bot

Self-hostable Discord bot for **AION 2** world-event timers. Slash command `/timer` shows upcoming Spacetime Rift, Shugo Festival, Dimensional Invasion, sieges, bosses, arena windows, and resets — with multi-region support.

Schedules are **community-observed / client-derived**, not an official NC API. Always cross-check with the in-game clock after patches.

## Features (MVP)

- `/timer [region] [event]` — upcoming countdowns with Discord-native timestamps (each reader sees local time)
- Region resolution: slash option → mapped Discord role → guild default → ephemeral select menu
- `/config` — set default region and role → region maps (`Manage Server` required)
- `/ping` — latency check
- Data-driven schedules for **Global** (NA East/West, EU, LATAM, Asia), **Korea**, and **Taiwan**
- SQLite guild settings (ready for a future public invite bot)

## Requirements

- Node.js **20.18+** (22+ recommended)
- A Discord application + bot token ([Developer Portal](https://discord.com/developers/applications))

## Quick start

```bash
cp .env.example .env
# fill DISCORD_TOKEN and CLIENT_ID
# set GUILD_ID to your test server for instant command updates

npm install
npm run deploy   # register slash commands
npm run dev      # or: npm run build && npm start
```

Invite the bot with scopes `bot` and `applications.commands`. Minimal permissions: **Send Messages**, **Embed Links**, **Use Application Commands**.

## Environment

| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | yes | Bot token |
| `CLIENT_ID` | yes | Application client ID |
| `GUILD_ID` | no | If set, `npm run deploy` registers guild commands (instant). Omit for global deploy. |
| `DATABASE_PATH` | no | SQLite path (default `./data/bot.sqlite`) |
| `NODE_ENV` | no | `development` / `production` |
| `LOG_LEVEL` | no | pino level (default `info`) |

Never commit `.env` or `*.sqlite`.

## Commands

### `/timer`

Shows the next upcoming events for the resolved region.

**Region resolution order**

1. `region:` option on the command  
2. A Discord role mapped via `/config role-map`  
3. Guild default from `/config region`  
4. Ephemeral select menu if still unknown (or if multiple mapped roles match)

### `/config`

| Subcommand | Purpose |
|---|---|
| `region` | Set/clear server default region |
| `role-map` | Map a role (e.g. `@EU`) to a region |
| `role-unmap` | Remove a role mapping |
| `show` | Print current config |

Example: create roles `EU`, `NA East`, `Asia`, then:

```
/config role-map role:@EU region:Europe
/config role-map role:@Asia region:Asia
/config region region:Europe
```

## Updating schedules after a patch

Event times live in versioned JSON — **not** hard-coded in TypeScript:

- [`data/regions.json`](data/regions.json) — region IDs, IANA timezones, schedule file mapping  
- [`data/events.meta.json`](data/events.meta.json) — display names / confidence  
- [`data/schedules/global.json`](data/schedules/global.json)  
- [`data/schedules/korea.json`](data/schedules/korea.json)  
- [`data/schedules/taiwan.json`](data/schedules/taiwan.json)

Workflow:

1. Confirm new times in-game (or from a trusted client dump / tracker).  
2. Edit the relevant schedule JSON (`hours`, `days`, durations, phases).  
3. Bump `verifiedAt` and adjust `confidence` if needed.  
4. Run `npm test` and redeploy the bot process (no slash re-deploy needed for data-only changes).

Extracting schedules from game files is useful **offline** for updating these JSON files. The bot never reads a game install at runtime.

## Development

```bash
npm run typecheck
npm test
npm run lint
npm run deploy   # after changing command definitions
```

Architecture sketch:

- `src/core/schedule-engine.ts` — DST-safe next-occurrence engine (Luxon)  
- `src/core/region-resolver.ts` — option / role / guild fallback  
- `src/persistence/` — SQLite store behind a small API (swapable later for Postgres)  
- `src/commands/` — one file per slash command  

## Roadmap (not in MVP)

- Persistent auto-updating timer panel  
- Pre-event mention alerts  
- Kill-based field boss trackers  
- Character / item lookup via PlayNC Open API  
- Hosted public invite bot (same codepath; shared DB)

## Disclaimer

Global regional timezones are **assumed** from community consensus (`Europe/Berlin`, `America/New_York`, …) unless marked otherwise. If countdowns disagree with your in-game clock, change `tz` in `data/regions.json` or pick another region and open an issue/PR.

## License

MIT
