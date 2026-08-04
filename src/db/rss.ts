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
    CREATE TABLE IF NOT EXISTS rss_feed_health (
      feed_url TEXT PRIMARY KEY,
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      last_failure_at INTEGER,
      next_retry_at INTEGER,
      notified INTEGER NOT NULL DEFAULT 0
    );
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

export interface FeedHealth {
  feed_url: string;
  consecutive_failures: number;
  last_error: string | null;
  last_failure_at: number | null;
  next_retry_at: number | null;
  notified: number;
}

export function getFeedHealth(feedUrl: string): FeedHealth | null {
  const stmt = getDb().prepare(`
    SELECT * FROM rss_feed_health WHERE feed_url = ?
  `);
  return (stmt.get(feedUrl) as FeedHealth | undefined) ?? null;
}

// Returns the new consecutive failure count. nextRetryAt is a unix timestamp (seconds).
export function recordFeedFailure(
  feedUrl: string,
  error: string,
  nextRetryAt: number
): number {
  const stmt = getDb().prepare(`
    INSERT INTO rss_feed_health (feed_url, consecutive_failures, last_error, last_failure_at, next_retry_at)
    VALUES (?, 1, ?, unixepoch(), ?)
    ON CONFLICT(feed_url) DO UPDATE SET
      consecutive_failures = consecutive_failures + 1,
      last_error = excluded.last_error,
      last_failure_at = excluded.last_failure_at,
      next_retry_at = excluded.next_retry_at
    RETURNING consecutive_failures
  `);
  const row = stmt.get(feedUrl, error, nextRetryAt) as {
    consecutive_failures: number;
  };
  return row.consecutive_failures;
}

export function recordFeedSuccess(feedUrl: string): void {
  const stmt = getDb().prepare(`
    UPDATE rss_feed_health
    SET consecutive_failures = 0, last_error = NULL, next_retry_at = NULL, notified = 0
    WHERE feed_url = ?
  `);
  stmt.run(feedUrl);
}

export function markFeedNotified(feedUrl: string): void {
  const stmt = getDb().prepare(`
    UPDATE rss_feed_health SET notified = 1 WHERE feed_url = ?
  `);
  stmt.run(feedUrl);
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
