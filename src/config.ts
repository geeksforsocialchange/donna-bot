import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  discord: {
    token: requireEnv("DISCORD_BOT_TOKEN"),
    guildId: requireEnv("DISCORD_GUILD_ID"),
  },
  google: {
    serviceAccountKey: requireEnv("GOOGLE_SERVICE_ACCOUNT_KEY"),
    calendarId: requireEnv("GOOGLE_CALENDAR_ID"),
  },
  rss: {
    feedsPath: process.env.RSS_FEEDS_PATH || "./config/rss-feeds.txt",
    channelId: process.env.RSS_CHANNEL_ID || "",
    pollIntervalMinutes: parseInt(
      process.env.RSS_POLL_INTERVAL_MINUTES || "5",
      10,
    ),
  },
  databasePath: process.env.DATABASE_PATH || "./data/donna.db",
  // Environment: "production", "development", or unset (defaults to production behavior)
  environment: process.env.NODE_ENV || "production",
  // When true, disables automatic event syncing (gateway events still received but ignored)
  disableAutoSync: process.env.DISABLE_AUTO_SYNC === "true",
  // When true, disables RSS feed polling
  disableRssSync: process.env.DISABLE_RSS_SYNC === "true",
};
