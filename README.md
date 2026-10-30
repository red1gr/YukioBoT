<div align="center">

<img src="https://r2.fivemanage.com/S1wPEooftNoEmQjn8jhwx/5b55ae114cd60f4af538b42a45814f09.jpg" alt="YUKIO LOGO" width="60" height="60" />

# YUKIO DASHBOARD

**A WEB DASHBOARD FOR THE YUKIO DISCORD BOT.**
**LIVE LOGS. MODERATION. LEVELING. PER-SERVER SETTINGS.**

<br />

[![REACT](https://img.shields.io/badge/REACT-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TYPESCRIPT](https://img.shields.io/badge/TYPESCRIPT-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![VITE](https://img.shields.io/badge/VITE-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![VERCEL](https://img.shields.io/badge/DEPLOY-VERCEL-000?logo=vercel&logoColor=white)](https://vercel.com)
[![LICENSE: MIT](https://img.shields.io/badge/LICENSE-MIT-green.svg)](LICENSE)

<br />

[**LIVE DEMO**](https://yukio.red1gr.dev/) &nbsp;|&nbsp; [**REPORT A BUG**](https://github.com/red1gr/YukioBoT/issues) &nbsp;|&nbsp; [**REQUEST A FEATURE**](https://github.com/red1gr/YukioBoT/issues)



---

## TABLE OF CONTENTS

- [OVERVIEW](#overview)
- [PREVIEW](#preview)
- [FEATURES](#features)
- [TECH STACK](#tech-stack)
- [PROJECT STRUCTURE](#project-structure)
- [GETTING STARTED](#getting-started)
- [DEPLOYING TO VERCEL](#deploying-to-vercel)
- [BACKEND API](#backend-api)
- [CONTRIBUTING](#contributing)
- [LICENSE](#license)

---

## OVERVIEW

YUKIO DASHBOARD IS A WEB INTERFACE FOR THE **YUKIO** DISCORD BOT. SIGN IN WITH DISCORD, PICK A SERVER AND MANAGE THE BOT DIRECTLY FROM THE BROWSER: LIVE LOGS, MODERATION, LEVELING, COGS AND PER-SERVER SETTINGS.



## FEATURES

| AREA | WHAT YOU GET |
|------|--------------|
| **LANDING PAGE** | THE BOT'S LIVE STATUS, AVATAR AND AN INVITE BUTTON |
| **LOGIN** | DISCORD OAUTH2, WITH THE SESSION HANDLED BY THE BOT BACKEND |
| **OVERVIEW** | PING, UPTIME, SERVERS, MEMBERS, COGS, COMMANDS, 7-DAY ACTIVITY CHART AND LATEST EVENTS |
| **LIVE LOGS** | AUTO-REFRESHING FEED WITH SEARCH, TYPE FILTER, CSV EXPORT AND PRUNING |
| **SERVER TOOLS** | LOG CHANNEL MAPPING, SEND MESSAGES AND EMBEDS, PURGE, DM, MEMBER SEARCH WITH WARN / TIMEOUT / NICKNAME / KICK / BAN, WARNINGS AND BANS LISTS |
| **LEADERBOARD** | XP, LEVEL AND MESSAGE COUNTS PER SERVER |
| **SETTINGS** | LOAD, UNLOAD AND RELOAD COGS, AND EDIT EACH COG'S PER-SERVER SETTINGS AND ACTIONS |
| **COMMANDS** | BROWSABLE LIST OF THE BOT'S SLASH COMMANDS |
| **OWNER CONTROLS** | PRESENCE, DMS AND LOG PRUNING |
| **INTERFACE** | RESPONSIVE LAYOUT, KEYBOARD SHORTCUTS (`1` TO `6` SWITCH VIEWS) AND REDUCED-MOTION SUPPORT |

---

## TECH STACK

| AREA | CHOICE |
|------|--------|
| UI | REACT 18 + TYPESCRIPT |
| BUILD | VITE 5 |
| STYLING | PLAIN CSS WITH DESIGN TOKENS (`src/styles.css`) |
| HOSTING | VERCEL, WITH REWRITES PROXYING TO THE BOT BACKEND |

---

## PROJECT STRUCTURE

```
.
├── index.html
├── vercel.json          # PROXIES /api, /login, /callback, /logout TO THE BACKEND
├── vite.config.ts       # SAME PROXY FOR LOCAL DEV
└── src/
    ├── main.tsx         # ENTRY POINT
    ├── App.tsx          # LANDING, DASHBOARD SHELL, TOASTS
    ├── views.tsx        # OVERVIEW, LOGS, SERVER, LEADERBOARD, SETTINGS, COMMANDS
    ├── api.ts           # FETCH HELPER AND TOAST BUS
    └── styles.css
```

---

## GETTING STARTED

**REQUIREMENTS:** NODE.JS 18 OR NEWER AND A RUNNING YUKIO BOT BACKEND THAT EXPOSES THE API BELOW.

```bash
npm install
cp .env.example .env     # ON WINDOWS: copy .env.example .env
npm run dev
```

THE APP RUNS AT `http://localhost:5173`. THE DEV SERVER FORWARDS `/api`, `/login` AND `/logout` TO `VITE_BACKEND`.

### ENVIRONMENT VARIABLES

| VARIABLE | USED FOR | REQUIRED |
|----------|----------|----------|
| `VITE_BOT_ID` | DISCORD CLIENT ID FOR THE INVITE LINK | YES |
| `VITE_BACKEND` | BACKEND URL FOR THE LOCAL DEV PROXY ONLY | DEV ONLY |

> **WARNING:** `VITE_` VARIABLES ARE BUNDLED INTO THE PUBLIC JAVASCRIPT. **NEVER** PUT THE BOT TOKEN OR OAUTH CLIENT SECRET IN ONE OF THEM. THOSE STAY ON THE BACKEND.

### SCRIPTS

| COMMAND | DESCRIPTION |
|---------|-------------|
| `npm run dev` | START THE DEV SERVER |
| `npm run build` | TYPE-CHECK AND BUILD TO `dist/` |
| `npm run preview` | SERVE THE PRODUCTION BUILD LOCALLY |

---

## DEPLOYING TO VERCEL

1. IMPORT THE REPOSITORY IN VERCEL. THE VITE PRESET IS DETECTED AUTOMATICALLY.
2. ADD `VITE_BOT_ID` UNDER **SETTINGS → ENVIRONMENT VARIABLES**, THEN DEPLOY.
3. EDIT THE DESTINATIONS IN `vercel.json` IF YOUR BACKEND ADDRESS CHANGES.
4. IN THE [DISCORD DEVELOPER PORTAL](https://discord.com/developers/applications), ADD `https://<your-domain>/callback` AS AN OAUTH2 REDIRECT URI, AND USE THE SAME VALUE IN YOUR BACKEND CONFIG.

MAKE SURE THE BACKEND REDIRECTS TO A RELATIVE `/` AFTER LOGIN AND DOES NOT SET A COOKIE `Domain` TIED TO ITS OWN ADDRESS. OTHERWISE USERS CAN END UP ON THE BACKEND HOST INSTEAD OF THE VERCEL SITE.

---

## BACKEND API

THE DASHBOARD EXPECTS THESE ENDPOINTS. ALL EXCEPT `/api/public` REQUIRE A LOGGED-IN SESSION, AND A `401` SENDS THE USER TO `/login`.

| METHOD | ENDPOINT | PURPOSE |
|--------|----------|---------|
| GET | `/api/public` | BOT NAME, AVATAR AND STATUS FOR THE LANDING PAGE |
| GET | `/api/me` | CURRENT USER, INCLUDING THE `owner` FLAG |
| GET | `/api/guilds` | SERVERS THE USER CAN MANAGE |
| GET | `/api/guilds/:id` | CHANNELS, ROLES, VOICE CHANNELS AND LOG SETTINGS |
| GET | `/api/overview`, `/api/stats`, `/api/commands` | OVERVIEW DATA, ACTIVITY STATS, COMMAND LIST |
| GET / DELETE | `/api/events` | EVENT FEED (`limit`, `guild_id`, `type`, `q`) AND PRUNING (`days`) |
| GET | `/api/events/export` | CSV EXPORT |
| POST | `/api/presence` | SET BOT PRESENCE (OWNER) |
| POST | `/api/guilds/:id/{send,embed,dm,purge,logchannel}` | MESSAGING AND CHANNEL ACTIONS |
| GET / POST | `/api/guilds/:id/members` AND `/members/:uid/{warn,timeout,nick,kick,ban,unban}` | MEMBER SEARCH AND MODERATION |
| GET / DELETE | `/api/guilds/:id/{warnings,bans}` | WARNINGS AND BANS |
| GET | `/api/guilds/:id/leaderboard` | XP LEADERBOARD |
| GET / POST | `/api/cogs`, `/api/cogs/:name/{load,unload,reload}` | COG MANAGEMENT |
| GET / POST | `/api/cogs/:name/settings/:guild`, `/api/cogs/:name/action/:guild` | PER-SERVER COG SETTINGS AND ACTIONS |

---

## CONTRIBUTING

ISSUES AND PULL REQUESTS ARE WELCOME. RUN `npm run build` BEFORE OPENING A PR SO TYPE ERRORS ARE CAUGHT.

1. FORK THE REPOSITORY
2. CREATE A BRANCH: `git checkout -b feature/YOUR-FEATURE`
3. COMMIT YOUR CHANGES
4. PUSH THE BRANCH AND OPEN A PULL REQUEST

---

## LICENSE

RELEASED UNDER THE [MIT LICENSE](LICENSE). COPYRIGHT (C) 2026 R E D 1.

<div align="center">

**[BACK TO TOP](#yukio-dashboard)**

</div>