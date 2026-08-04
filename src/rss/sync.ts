import { Client, EmbedBuilder, TextChannel } from "discord.js";
import { config } from "../config.js";
import {
  getFeedHealth,
  isEntryPosted,
  markEntryPosted,
  markFeedNotified,
  recordFeedFailure,
  recordFeedSuccess,
} from "../db/rss.js";
import { loadFeedUrls } from "./feeds.js";
import { parseFeed, RssEntry } from "./parser.js";

const EMBED_COLOR = 0x5865f2; // Discord blurple
const MAX_AGE_DAYS = 60; // Only post entries from the last 60 days
const DISPLAY_TIMEZONE = "Europe/London"; // Show dates in UK time regardless of container TZ
const FAILURE_NOTIFY_THRESHOLD = 5; // Post a channel notice after this many consecutive failures
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000; // Never back off longer than 6 hours

// Exponential backoff: first failure retries on the next poll, then doubles, capped at MAX_BACKOFF_MS
export function computeBackoffMs(
  consecutiveFailures: number,
  pollIntervalMinutes: number
): number {
  const baseMs = pollIntervalMinutes * 60 * 1000;
  return Math.min(baseMs * 2 ** (consecutiveFailures - 1), MAX_BACKOFF_MS);
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function createEmbed(entry: RssEntry, feedTitle: string | null): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(truncate(entry.title, 256))
    .setURL(entry.link || null);

  if (entry.description) {
    embed.setDescription(truncate(entry.description, 300));
  }

  const footerParts: string[] = [];
  if (feedTitle) {
    footerParts.push(feedTitle);
  } else if (entry.link) {
    footerParts.push(extractDomain(entry.link));
  }
  if (entry.pubDate) {
    footerParts.push(
      entry.pubDate.toLocaleDateString("en-GB", { timeZone: DISPLAY_TIMEZONE })
    );
  }
  if (footerParts.length > 0) {
    embed.setFooter({ text: footerParts.join(" • ") });
  }

  if (entry.author) {
    embed.setAuthor({ name: entry.author });
  }

  if (entry.imageUrl) {
    embed.setImage(entry.imageUrl);
  }

  return embed;
}

// A failed notice must never abort the sync loop for the remaining feeds
async function sendNotice(channel: TextChannel, content: string): Promise<void> {
  try {
    await channel.send({ content });
  } catch (error) {
    console.error("[RSS] Failed to send channel notice:", error);
  }
}

export async function syncFeeds(client: Client): Promise<void> {
  if (!config.rss.channelId) {
    console.log("[RSS] No channel ID configured, skipping sync");
    return;
  }

  const channel = await client.channels.fetch(config.rss.channelId);
  if (!channel || !(channel instanceof TextChannel)) {
    console.error("[RSS] Channel not found or not a text channel");
    return;
  }

  const feedUrls = loadFeedUrls();
  if (feedUrls.length === 0) {
    return;
  }

  let totalNew = 0;

  for (const feedUrl of feedUrls) {
    const health = getFeedHealth(feedUrl);

    // Feed is backing off after repeated failures; skip until its retry time
    if (health?.next_retry_at && Date.now() < health.next_retry_at * 1000) {
      continue;
    }

    try {
      const feed = await parseFeed(feedUrl);
      const newEntries: RssEntry[] = [];

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - MAX_AGE_DAYS);

      for (const entry of feed.entries) {
        if (!entry.guid) continue;
        // Skip entries older than cutoff date
        if (entry.pubDate && entry.pubDate < cutoffDate) continue;
        if (!isEntryPosted(feedUrl, entry.guid)) {
          newEntries.push(entry);
        }
      }

      // Post entries in chronological order (oldest first)
      newEntries.sort((a, b) => {
        const aTime = a.pubDate?.getTime() || 0;
        const bTime = b.pubDate?.getTime() || 0;
        return aTime - bTime;
      });

      for (const entry of newEntries) {
        const embed = createEmbed(entry, feed.feedTitle);
        await channel.send({ embeds: [embed] });
        markEntryPosted(feedUrl, entry.guid, entry.title);
        totalNew++;
        console.log(`[RSS] Posted: ${entry.title}`);
      }

      if (health && health.consecutive_failures > 0) {
        console.log(
          `[RSS] Feed recovered after ${health.consecutive_failures} failures: ${feedUrl}`
        );
        if (health.notified) {
          await sendNotice(channel, `✅ RSS feed <${feedUrl}> is working again.`);
        }
      }
      recordFeedSuccess(feedUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const backoffMs = computeBackoffMs(
        (health?.consecutive_failures ?? 0) + 1,
        config.rss.pollIntervalMinutes
      );
      const nextRetryAt = Math.floor((Date.now() + backoffMs) / 1000);
      const failures = recordFeedFailure(feedUrl, message, nextRetryAt);
      console.error(
        `[RSS] Error fetching ${feedUrl} (failure #${failures}, retrying in ${Math.round(backoffMs / 60000)} min):`,
        error
      );

      if (failures >= FAILURE_NOTIFY_THRESHOLD && !health?.notified) {
        await sendNotice(
          channel,
          `⚠️ RSS feed <${feedUrl}> has failed ${failures} times in a row ` +
            `(last error: ${truncate(message, 200)}). ` +
            `I'll keep retrying (backing off up to every 6 hours) and post here when it recovers.`
        );
        markFeedNotified(feedUrl);
      }
    }
  }

  if (totalNew > 0) {
    console.log(`[RSS] Posted ${totalNew} new entries`);
  }
}
