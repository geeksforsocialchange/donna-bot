import cron from "node-cron";
import { Client } from "discord.js";
import { config } from "../config.js";
import { syncFeeds } from "./sync.js";

let cronTask: cron.ScheduledTask | null = null;

export function startRssPoller(client: Client): void {
  if (config.disableRssSync) {
    console.log("[RSS] RSS sync disabled via config");
    return;
  }

  if (!config.rss.channelId) {
    console.log("[RSS] No RSS_CHANNEL_ID configured, RSS poller not started");
    return;
  }

  const intervalMinutes = config.rss.pollIntervalMinutes;
  const cronExpression = `*/${intervalMinutes} * * * *`;

  console.log(`[RSS] Starting poller with ${intervalMinutes} minute interval`);

  // Run immediately on startup
  syncFeeds(client).catch((error) => {
    console.error("[RSS] Initial sync error:", error);
  });

  // Schedule periodic polling
  cronTask = cron.schedule(cronExpression, () => {
    console.log("[RSS] Running scheduled feed check...");
    syncFeeds(client).catch((error) => {
      console.error("[RSS] Sync error:", error);
    });
  });

  console.log("[RSS] Poller started");
}

export function stopRssPoller(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log("[RSS] Poller stopped");
  }
}
