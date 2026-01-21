import { readFileSync, existsSync } from "fs";
import { config } from "../config.js";

export function loadFeedUrls(): string[] {
  const feedsPath = config.rss.feedsPath;

  if (!existsSync(feedsPath)) {
    console.log(`[RSS] Feeds file not found at ${feedsPath}`);
    return [];
  }

  const content = readFileSync(feedsPath, "utf-8");
  const lines = content.split("\n");

  const urls: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    // Basic URL validation
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      urls.push(trimmed);
    } else {
      console.log(`[RSS] Skipping invalid URL: ${trimmed}`);
    }
  }

  console.log(`[RSS] Loaded ${urls.length} feed URLs from ${feedsPath}`);
  return urls;
}
