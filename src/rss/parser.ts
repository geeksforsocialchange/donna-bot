import { request } from 'gaxios';
import Parser from "rss-parser";
import { FeedMetadata, entryMetaData, setEntryMetadata } from "../db/rss.ts";

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "donna-bot/1.0 RSS Reader",
  },
});

export interface RssEntry {
  guid: string;
  title: string;
  link: string;
  pubDate: Date | null;
  description: string | null;
  author: string | null;
}

export interface ParsedFeed {
  feedUrl: string;
  feedTitle: string | null;
  entries: RssEntry[];
}

export async function parseFeed(feedUrl: string): Promise<ParsedFeed> {
  const originalMetaData = entryMetaData(feedUrl)
  const res = await request({
    url: feedUrl, headers: new Headers({
      "User-Agent": "donna-bot/1.0 RSS Reader",
      "If-Modified-Since": originalMetaData.last_modified,
      "If-None-Match": originalMetaData.etag
    })
  })
  const feed = await parser.parseString(String(res.body!));
  const newMetaData = {
    etag: res.headers.get('etag'),
    last_modified: res.headers.get('last-modified')
  } as FeedMetadata
  setEntryMetadata(feedUrl, newMetaData);

  const entries: RssEntry[] = (feed.items || []).map((item) => ({
    // Use guid, or link, or title as fallback for unique identifier
    guid: item.guid || item.link || item.title || "",
    title: item.title || "(no title)",
    link: item.link || "",
    pubDate: item.pubDate ? new Date(item.pubDate) : null,
    description: item.contentSnippet || item.content || null,
    author: item.creator || item.author || null,
  }));

  return {
    feedUrl,
    feedTitle: feed.title || null,
    entries,
  };
}
