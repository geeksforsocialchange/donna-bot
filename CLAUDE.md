# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

donna-bot is the GFSC community Discord bot. Currently implements Discord → Google Calendar event sync.

## Commands

```bash
npm run dev      # Run with hot reload (tsx watch)
npm run build    # Compile TypeScript to dist/
npm run start    # Run compiled JS
npm run lint     # ESLint
npm test         # Run tests
```

## Architecture

```
Discord Gateway Events → Event Handlers → Sync Logic → Google Calendar API
                                              ↓
                                     SQLite (ID mappings)
```

**Key files:**
- `src/index.ts` - Entry point, Discord client setup, slash commands
- `src/discord/events.ts` - Gateway event handlers (create/update/delete)
- `src/google/calendar.ts` - Google Calendar API wrapper
- `src/sync/eventSync.ts` - Core sync logic
- `src/sync/recurrence.ts` - Discord recurrence → RRULE conversion
- `src/db/mappings.ts` - SQLite database for Discord↔GCal ID mappings

## Key Technical Details

- Uses Discord.js Gateway (persistent WebSocket), not HTTP webhooks
- Google Calendar auth via Service Account (base64-encoded JSON key in env)
- SQLite stores `discord_event_id → google_event_id` mappings
- Recurring events: Discord's `recurrenceRule` converted to RFC 5545 RRULE

## Deployment

- Docker image built with Node 22 Alpine
- Deployed via Kamal (config in `config/deploy.yml`)
- GitHub Actions workflow on push to main: lint → build → test → deploy
- SQLite database persisted via Docker volume at `/app/data/donna.db`

## Adding New Features

The codebase is structured for extensibility. Future features (GitHub integration, Mailman, etc.) should:
1. Add new module directory under `src/` (e.g., `src/github/`)
2. Register any new event handlers in `src/index.ts`
3. Add new slash commands in the `registerCommands()` function
