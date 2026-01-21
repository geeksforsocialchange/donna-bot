import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import { config } from "../config.js";

let db: Database.Database | null = null;

export function initRssDatabase(): void {
  const dbPath = config.databasePath;
  const dbDir = dirname(dbPath);

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS rss_posted (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feed_url TEXT NOT NULL,
      entry_guid TEXT NOT NULL,
      entry_title TEXT,
      posted_at INTEGER DEFAULT (unixepoch()),
      UNIQUE(feed_url, entry_guid)
    );
    CREATE INDEX IF NOT EXISTS idx_rss_feed_url ON rss_posted(feed_url);
  `);

  console.log(`[RSS DB] RSS tables initialized`);
}

function getDb(): Database.Database {
  if (!db) {
    throw new Error("RSS Database not initialized. Call initRssDatabase() first.");
  }
  return db;
}

export interface RssPosted {
  id: number;
  feed_url: string;
  entry_guid: string;
  entry_title: string | null;
  posted_at: number;
}

export function isEntryPosted(feedUrl: string, entryGuid: string): boolean {
  const stmt = getDb().prepare(`
    SELECT 1 FROM rss_posted WHERE feed_url = ? AND entry_guid = ?
  `);
  return stmt.get(feedUrl, entryGuid) !== undefined;
}

export function markEntryPosted(
  feedUrl: string,
  entryGuid: string,
  entryTitle: string | null
): void {
  const stmt = getDb().prepare(`
    INSERT OR IGNORE INTO rss_posted (feed_url, entry_guid, entry_title)
    VALUES (?, ?, ?)
  `);
  stmt.run(feedUrl, entryGuid, entryTitle);
}

export function getPostedEntries(feedUrl?: string): RssPosted[] {
  if (feedUrl) {
    const stmt = getDb().prepare(`
      SELECT * FROM rss_posted WHERE feed_url = ? ORDER BY posted_at DESC
    `);
    return stmt.all(feedUrl) as RssPosted[];
  }

  const stmt = getDb().prepare(`SELECT * FROM rss_posted ORDER BY posted_at DESC`);
  return stmt.all() as RssPosted[];
}
