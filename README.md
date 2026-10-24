# Yukio Dashboard

A web dashboard for the **Yukio** Discord bot. Sign in with Discord, pick a server and manage the bot from the browser: live logs, moderation, leveling, cogs and per-server settings.

![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=white)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000?logo=vercel&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

## Features

- **Landing page** with the bot's live status, avatar and an invite button
- **Discord OAuth2 login**, with the session handled by the bot backend
- **Overview**: ping, uptime, servers, members, cogs, commands, 7-day activity chart and latest events
- **Live logs**: auto-refreshing feed with search, type filter, CSV export and pruning
- **Server tools**: log channel mapping, send messages and embeds, purge, DM, member search with warn / timeout / nickname / kick / ban, warnings and bans lists
- **Leaderboard**: XP, level and message counts per server
- **Settings**: load, unload and reload cogs, and edit each cog's per-server settings and actions
- **Commands**: browsable list of the bot's slash commands
- **Owner-only controls** for presence, DMs and log pruning
- Responsive layout, keyboard shortcuts (`1` to `6` switch views) and reduced-motion support

## Tech stack

| Area | Choice |
| --- | --- |
| UI | React 18 + TypeScript |
| Build | Vite 5 |
| Styling | Plain CSS with design tokens (`src/styles.css`) |
| Hosting | Vercel, with rewrites proxying to the bot backend |

## Project structure

```
.
├── index.html
├── vercel.json          # proxies /api, /login, /callback, /logout to the backend
├── vite.config.ts       # same proxy for local dev
└── src/
    ├── main.tsx         # entry point
    ├── App.tsx          # landing, dashboard shell, toasts
    ├── views.tsx        # Overview, Logs, Server, Leaderboard, Settings, Commands
    ├── api.ts           # fetch helper and toast bus
    └── styles.css
```

## Getting started

**Requirements:** Node.js 18 or newer and a running Yukio bot backend that exposes the API below.

```bash
npm install
cp .env.example .env     # on Windows: copy .env.example .env
npm run dev
```

The app runs at `http://localhost:5173`. The dev server forwards `/api`, `/login` and `/logout` to `VITE_BACKEND`.

### Environment variables

| Variable | Used for | Required |
| --- | --- | --- |
| `VITE_BOT_ID` | Discord client ID for the invite link | Yes |
| `VITE_BACKEND` | Backend URL for the local dev proxy only | Dev only |

`VITE_` variables are bundled into the public JavaScript. **Never** put the bot token or OAuth client secret in one of them. Those stay on the backend.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build locally |

## Deploying to Vercel

1. Import the repository in Vercel. The Vite preset is detected automatically.
2. Add `VITE_BOT_ID` under **Settings → Environment Variables**, then deploy.
3. Edit the destinations in `vercel.json` if your backend address changes.
4. In the [Discord Developer Portal](https://discord.com/developers/applications), add `https://<your-domain>/callback` as an OAuth2 redirect URI, and use the same value in your backend config.

Make sure the backend redirects to a relative `/` after login and does not set a cookie `Domain` tied to its own address. Otherwise users can end up on the backend host instead of the Vercel site.

## Backend API

The dashboard expects these endpoints. All except `/api/public` require a logged-in session, and a `401` sends the user to `/login`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/public` | Bot name, avatar and status for the landing page |
| GET | `/api/me` | Current user, including the `owner` flag |
| GET | `/api/guilds` | Servers the user can manage |
| GET | `/api/guilds/:id` | Channels, roles, voice channels and log settings |
| GET | `/api/overview`, `/api/stats`, `/api/commands` | Overview data, activity stats, command list |
| GET / DELETE | `/api/events` | Event feed (`limit`, `guild_id`, `type`, `q`) and pruning (`days`) |
| GET | `/api/events/export` | CSV export |
| POST | `/api/presence` | Set bot presence (owner) |
| POST | `/api/guilds/:id/{send,embed,dm,purge,logchannel}` | Messaging and channel actions |
| GET / POST | `/api/guilds/:id/members` and `/members/:uid/{warn,timeout,nick,kick,ban,unban}` | Member search and moderation |
| GET / DELETE | `/api/guilds/:id/{warnings,bans}` | Warnings and bans |
| GET | `/api/guilds/:id/leaderboard` | XP leaderboard |
| GET / POST | `/api/cogs`, `/api/cogs/:name/{load,unload,reload}` | Cog management |
| GET / POST | `/api/cogs/:name/settings/:guild`, `/api/cogs/:name/action/:guild` | Per-server cog settings and actions |

## Contributing

Issues and pull requests are welcome. Run `npm run build` before opening a PR so type errors are caught.

## License

Released under the [MIT License](LICENSE). Copyright (c) 2026 𝗥 𝗘 𝗗 𝟭.