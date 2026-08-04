import Parser from "rss-parser";

// Custom fields we pull out of feeds for image extraction. rss-parser maps
// content:encoded to `content` by default, but media:* need declaring.
interface FeedItemFields {
  mediaContent?: MediaNode | MediaNode[];
  mediaThumbnail?: MediaNode | MediaNode[];
  // Supplying a custom item type drops rss-parser's index signature, so
  // re-declare the non-core fields we read off items.
  author?: string;
}

interface MediaNode {
  $?: { url?: string; medium?: string; type?: string };
}

const parser: Parser<unknown, FeedItemFields> = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "donna-bot/1.0 RSS Reader",
  },
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
    ],
  },
});

export interface RssEntry {
  guid: string;
  title: string;
  link: string;
  pubDate: Date | null;
  description: string | null;
  author: string | null;
  imageUrl: string | null;
}

export interface ParsedFeed {
  feedUrl: string;
  feedTitle: string | null;
  entries: RssEntry[];
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp)(\?|$)/i;

function isHttpUrl(url: string | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

// True when a node's type/medium marks it an image, or (absent those) its URL
// has an image extension. A bare valid URL is not enough.
function isImageNode(url: string | undefined, type?: string, medium?: string): boolean {
  if (!isHttpUrl(url)) return false;
  if (medium === "image") return true;
  if (type?.startsWith("image/")) return true;
  if (!type && !medium) return IMAGE_EXT.test(url);
  return false;
}

// Pick the first usable image from an item, in order of reliability:
// enclosure, media:content, media:thumbnail, then a raw <img> in the content HTML.
function extractImageUrl(
  item: Parser.Item & FeedItemFields & { content?: string }
): string | null {
  if (
    item.enclosure &&
    isImageNode(item.enclosure.url, item.enclosure.type)
  ) {
    return item.enclosure.url ?? null;
  }

  for (const node of toArray(item.mediaContent)) {
    if (isImageNode(node.$?.url, node.$?.type, node.$?.medium)) {
      return node.$?.url ?? null;
    }
  }

  for (const node of toArray(item.mediaThumbnail)) {
    // media:thumbnail is image-by-definition, so any valid URL qualifies.
    if (isHttpUrl(node.$?.url)) {
      return node.$?.url ?? null;
    }
  }

  const html = item.content ?? "";
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match && isHttpUrl(match[1])) {
    return match[1];
  }

  return null;
}

export async function parseFeed(feedUrl: string): Promise<ParsedFeed> {
  const feed = await parser.parseURL(feedUrl);

  const entries: RssEntry[] = (feed.items || []).map((item) => ({
    // Use guid, or link, or title as fallback for unique identifier
    guid: item.guid || item.link || item.title || "",
    title: item.title || "(no title)",
    link: item.link || "",
    pubDate: item.pubDate ? new Date(item.pubDate) : null,
    description: item.contentSnippet || item.content || null,
    author: item.creator || item.author || null,
    imageUrl: extractImageUrl(item),
  }));

  return {
    feedUrl,
    feedTitle: feed.title || null,
    entries,
  };
}

export { extractImageUrl };
