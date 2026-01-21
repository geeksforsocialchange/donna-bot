# donna-bot

GFSC Community Discord Bot.

## Features

- **Discord → Google Calendar Sync**: Automatically syncs Discord scheduled events (including recurring events) to a shared Google Calendar
- **RSS Salon**: Polls RSS feeds and posts new entries to a Discord channel. Community members can add feeds via PR to `config/rss-feeds.txt`

## Setup

### 1. Discord Bot

1. Create a new application at [Discord Developer Portal](https://discord.com/developers/applications)
2. Go to Bot → Reset Token → copy the token
3. Enable these Privileged Gateway Intents:
   - None required (GuildScheduledEvents is not privileged)
4. Go to OAuth2 → URL Generator:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `View Channels`, `Manage Events`
5. Use the generated URL to invite the bot to your server

### 2. Google Calendar

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Google Calendar API
3. Create a Service Account (IAM → Service Accounts → Create)
4. Create a key for the service account (JSON format)
5. Base64-encode the JSON key: `base64 -i credentials.json`
6. Share your target calendar with the service account email (found in the JSON)

### 3. Environment Variables

Copy `.env.example` to `.env` and fill in:

```
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_GUILD_ID=your_server_id
GOOGLE_SERVICE_ACCOUNT_KEY=base64_encoded_json
GOOGLE_CALENDAR_ID=calendar_id@group.calendar.google.com

# RSS Salon (optional)
RSS_CHANNEL_ID=discord_channel_id
RSS_FEEDS_PATH=./config/rss-feeds.txt
RSS_POLL_INTERVAL_MINUTES=5
```

### 4. Run Locally

```bash
npm install
npm run dev
```

### 5. Deploy with Kamal

1. Edit `config/deploy.yml` with your server details
2. Set GitHub Secrets:
   - `SSH_PRIVATE_KEY` - SSH key for your server
   - `DISCORD_BOT_TOKEN`
   - `DISCORD_GUILD_ID`
   - `GOOGLE_SERVICE_ACCOUNT_KEY`
   - `GOOGLE_CALENDAR_ID`
3. Push to `main` branch

## Commands

- `/sync-events` - Manually sync all existing Discord events to Google Calendar
- `/cleanup-calendar` - Remove orphaned Google Calendar events not linked to Discord
- `/list-mappings` - List all Discord → Google Calendar event mappings
- `/list-feeds` - List configured RSS feeds
- `/refresh-feeds` - Manually check RSS feeds for new entries

## How It Works

The bot listens for Discord Gateway events:
- `GuildScheduledEventCreate` → Creates a Google Calendar event
- `GuildScheduledEventUpdate` → Updates the corresponding calendar event
- `GuildScheduledEventDelete` → Deletes the calendar event

Event mappings (Discord ID ↔ Google Calendar ID) are stored in a SQLite database.

Recurring events are converted from Discord's recurrence rule format to Google Calendar's RRULE format.

### RSS Salon

The bot polls RSS feeds every 5 minutes (configurable) and posts new entries to a Discord channel as embeds. Only entries from the last 60 days are posted to avoid flooding on initial setup.

To add a feed, submit a PR adding the feed URL to `config/rss-feeds.txt` (one URL per line).
