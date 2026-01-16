import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import { config } from "../config.js";

let db: Database.Database | null = null;

export function initDatabase(): void {
  const dbPath = config.databasePath;
  const dbDir = dirname(dbPath);

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS event_mappings (
      discord_event_id TEXT PRIMARY KEY,
      google_event_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_google_event_id ON event_mappings(google_event_id);
    CREATE INDEX IF NOT EXISTS idx_guild_id ON event_mappings(guild_id);
  `);

  console.log(`[DB] Database initialized at ${dbPath}`);
}

function getDb(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return db;
}

export interface EventMapping {
  discord_event_id: string;
  google_event_id: string;
  guild_id: string;
  created_at: number;
  updated_at: number;
}

export function saveMapping(
  discordEventId: string,
  googleEventId: string,
  guildId: string
): void {
  const stmt = getDb().prepare(`
    INSERT INTO event_mappings (discord_event_id, google_event_id, guild_id)
    VALUES (?, ?, ?)
    ON CONFLICT(discord_event_id) DO UPDATE SET
      google_event_id = excluded.google_event_id,
      updated_at = unixepoch()
  `);
  stmt.run(discordEventId, googleEventId, guildId);
}

export function getMapping(discordEventId: string): EventMapping | undefined {
  const stmt = getDb().prepare(`
    SELECT * FROM event_mappings WHERE discord_event_id = ?
  `);
  return stmt.get(discordEventId) as EventMapping | undefined;
}

export function deleteMapping(discordEventId: string): void {
  const stmt = getDb().prepare(`
    DELETE FROM event_mappings WHERE discord_event_id = ?
  `);
  stmt.run(discordEventId);
}

export function getAllMappings(guildId?: string): EventMapping[] {
  if (guildId) {
    const stmt = getDb().prepare(`
      SELECT * FROM event_mappings WHERE guild_id = ?
    `);
    return stmt.all(guildId) as EventMapping[];
  }

  const stmt = getDb().prepare(`SELECT * FROM event_mappings`);
  return stmt.all() as EventMapping[];
}
