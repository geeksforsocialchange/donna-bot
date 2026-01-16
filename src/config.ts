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
  databasePath: process.env.DATABASE_PATH || "./data/donna.db",
};
