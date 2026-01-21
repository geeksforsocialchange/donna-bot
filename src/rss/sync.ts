import { Client, EmbedBuilder, TextChannel } from "discord.js";
import { config } from "../config.js";
import { isEntryPosted, markEntryPosted } from "../db/rss.js";
import { loadFeedUrls } from "./feeds.js";
import { parseFeed, RssEntry } from "./parser.js";

const EMBED_COLOR = 0x5865f2; // Discord blurple
const MAX_AGE_DAYS = 60; // Only post entries from the last 60 days

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
    footerParts.push(entry.pubDate.toLocaleDateString());
  }
  if (footerParts.length > 0) {
    embed.setFooter({ text: footerParts.join(" • ") });
  }

  if (entry.author) {
    embed.setAuthor({ name: entry.author });
  }

  return embed;
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
    } catch (error) {
      console.error(`[RSS] Error fetching ${feedUrl}:`, error);
    }
  }

  if (totalNew > 0) {
    console.log(`[RSS] Posted ${totalNew} new entries`);
  }
}
