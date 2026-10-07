# AION 2 Discord Bot

Self-hostable Discord bot for **AION 2** world-event timers — multi-region countdowns, live panel, and pre-event alerts.

Schedules are **community-observed / client-derived**, not an official NC API. Always cross-check with the in-game clock after patches.

## Features

- `/timer` — upcoming event board (Discord-native timestamps)
- `/next` — next single event (default: Spacetime Rift)
- `/reset` — next daily + weekly reset
- `/panel` — live message that auto-edits about every minute
- `/alert` — channel pings before selected events
- `/config` — guild default region + role → region maps
- `/ping` — latency
- `npm run sync-check` — offline diff vs [Shugo.GG `timers.json`](https://shugo.gg/timers.json)

Regions: Global (NA East/West, EU, LATAM, Asia), Korea, Taiwan.

## Requirements

- Node.js **20.18+** (22+ recommended)
- Discord application + bot token ([Developer Portal](https://discord.com/developers/applications))

## Quick start

```bash
cp .env.example .env
# DISCORD_TOKEN, CLIENT_ID, GUILD_ID (dev)

npm install
npm run deploy
npm run dev
```

Invite scopes: `bot` + `applications.commands`.  
Permissions: **Send Messages**, **Embed Links**, **Use Application Commands**, **Mention Roles** (only if `/alert` uses role pings).

Do **not** enable Presence / Server Members / Message Content intents.

## Environment

| Variable | Required | Description |
|---|---|---|
| `DISCORD_TOKEN` | yes | Bot token |
| `CLIENT_ID` | yes | Application client ID |
| `GUILD_ID` | no | Guild command deploy (instant). Omit for global. |
| `DATABASE_PATH` | no | SQLite path (default `./data/bot.sqlite`) |
| `NODE_ENV` | no | `development` / `production` |
| `LOG_LEVEL` | no | pino level (default `info`) |

Never commit `.env` or `*.sqlite`.

## Commands

### Region resolution (shared)

1. `region:` option  
2. Mapped Discord role (`/config role-map`)  
3. Guild default (`/config region`)  
4. Ephemeral select menu  

### `/timer [region] [event]`

Upcoming board for the resolved region.

### `/next [event] [region]`

One-liner for the next occurrence (default event: Spacetime Rift).

### `/reset [region]`

Next daily and weekly reset times.

### `/panel` (Manage Server)

| Subcommand | Purpose |
|---|---|
| `setup [region]` | Post a live board in this channel |
| `remove` | Stop updating the panel in this channel |
| `list` | List panels on this server |

### `/alert` (Manage Server)

| Subcommand | Purpose |
|---|---|
| `add event: [minutes:] [region:] [role:]` | Ping this channel before an event (default T-15) |
| `remove id:` | Delete an alert |
| `list` | Show alerts |

Avoid alerting hourly Shugo / Invasion unless you want channel noise.

### `/config` (Manage Server)

| Subcommand | Purpose |
|---|---|
| `region` | Set/clear server default |
| `role-map` / `role-unmap` | Map Discord roles to regions |
| `show` | Print config |

```
/config role-map role:@EU region:Europe
/config region region:Europe
/panel setup
/alert add event:Spacetime Rift minutes:15 role:@RiftPing
```

## Updating schedules

Data files (not TypeScript):

- [`data/regions.json`](data/regions.json)
- [`data/events.meta.json`](data/events.meta.json)
- [`data/schedules/global.json`](data/schedules/global.json)
- [`data/schedules/korea.json`](data/schedules/korea.json)
- [`data/schedules/taiwan.json`](data/schedules/taiwan.json)

### After a patch

```bash
npm run sync-check    # compare local JSON ↔ Shugo.GG public timers.json
# edit data/schedules/*.json if needed, bump verifiedAt
npm test
# restart bot process (no redeploy needed for data-only changes)
```

`sync-check` is **compare-only** — it never overwrites local files. Exit code `1` means mismatches to review. Also spot-check [MetaBot events](https://metabot.gg/en/aion-2/events) and in-game clocks.

Manual cross-check is still required for KR siege *groups* (multiple start times) and anything Arena-related (not in Shugo timers.json).

## Development

```bash
npm run typecheck
npm test
npm run lint
npm run sync-check
npm run deploy   # after changing slash command definitions
```

## Roadmap

- Kill-based field boss trackers  
- Character / item lookup (PlayNC Open API)  
- Hosted public invite bot  

## Disclaimer

Global regional timezones follow community consensus (aligned with Shugo.GG where possible). If countdowns disagree with your in-game clock, adjust `tz` in `data/regions.json`.

## License

MIT
