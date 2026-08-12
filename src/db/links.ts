import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import { config } from "../config.js";

let db: Database.Database | null = null;

export function initLinksDatabase(): void {
  const dbPath = config.databasePath;
  const dbDir = dirname(dbPath);

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS github_links (
      discord_id TEXT PRIMARY KEY,
      github_username TEXT NOT NULL,
      linked_at INTEGER DEFAULT (unixepoch())
    );
  `);

  console.log(`[GitHub DB] GitHub tables initialized`);
}

function getDb(): Database.Database {
  if (!db) {
    throw new Error(
      "GitHub Database not initialized. Call initLinksDatabase() first.",
    );
  }
  return db;
}

export function setGithubLink(
  discordUserId: string,
  githubUsername: string,
): void {
  const stmt = getDb().prepare(`
    INSERT INTO github_links (discord_id, github_username)
    VALUES (?, ?)
    ON CONFLICT(discord_id) DO UPDATE SET
      github_username = excluded.github_username,
      linked_at = unixepoch()
  `);
  stmt.run(discordUserId, githubUsername);
}

export function getGithubLink(discordUserId: string): string | null {
  const stmt = getDb().prepare(`
    SELECT github_username FROM github_links WHERE discord_id = ?
  `);
  const row = stmt.get(discordUserId) as
    | { github_username: string }
    | undefined;
  return row?.github_username ?? null;
}
