import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import { config } from "./config.js";
import { registerEventHandlers } from "./discord/events.js";
import { initDatabase, getAllMappings } from "./db/mappings.js";
import { initRssDatabase } from "./db/rss.js";
import { getGithubUsername } from "./people/people.js";
import {
  fetchOpenIssues,
  formatIssueLines,
  joinLinesWithinLimit,
} from "./github/api.js";
import { bulkSyncEvents, cleanupOrphanedEvents } from "./sync/eventSync.js";
import { startRssPoller } from "./rss/poller.js";
import { loadFeedUrls } from "./rss/feeds.js";
import { syncFeeds } from "./rss/sync.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildScheduledEvents],
});

// /tickets nudges people carrying more open assignments than this
const MAX_HEALTHY_ASSIGNED = 5;

async function registerCommands(): Promise<void> {
  const commands = [
    new SlashCommandBuilder()
      .setName("sync-events")
      .setDescription("Manually sync all Discord events to Google Calendar"),
    new SlashCommandBuilder()
      .setName("cleanup-calendar")
      .setDescription(
        "Remove duplicate/orphaned Google Calendar events not linked to Discord events",
      ),
    new SlashCommandBuilder()
      .setName("list-mappings")
      .setDescription("List all Discord → Google Calendar event mappings"),
    new SlashCommandBuilder()
      .setName("list-feeds")
      .setDescription("List all configured RSS feeds"),
    new SlashCommandBuilder()
      .setName("refresh-feeds")
      .setDescription("Manually check all RSS feeds for new entries"),
    new SlashCommandBuilder()
      .setName("tickets")
      .setDescription("List open GitHub issues assigned to you in the GFSC org"),
    new SlashCommandBuilder()
      .setName("tickets-share")
      .setDescription("Post your open GFSC issues to the channel for others to see"),
  ];

  const rest = new REST().setToken(config.discord.token);

  console.log("[Commands] Registering slash commands...");
  await rest.put(
    Routes.applicationGuildCommands(client.user!.id, config.discord.guildId),
    { body: commands.map((c) => c.toJSON()) },
  );
  console.log("[Commands] Slash commands registered");
}

client.once("ready", async () => {
  console.log(`[Bot] Logged in as ${client.user?.tag}`);
  console.log(`[Bot] Environment: ${config.environment}`);
  console.log(
    `[Bot] Auto-sync: ${config.disableAutoSync ? "DISABLED" : "enabled"}`,
  );
  console.log(
    `[Bot] RSS sync: ${config.disableRssSync ? "DISABLED" : "enabled"}`,
  );
  console.log(`[Bot] Database: ${config.databasePath}`);
  if (!config.github.token) {
    console.warn(
      "[Bot] GITHUB_TOKEN not set: /tickets cannot see private repos and will return wrong results",
    );
  }
  await registerCommands();
  registerEventHandlers(client);
  startRssPoller(client);
  console.log("[Bot] Ready and listening for scheduled events");
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "sync-events") {
    console.log("[Sync] /sync-events command received");
    try {
      await interaction.deferReply({ ephemeral: true });
    } catch (error) {
      console.error("[Sync] Failed to defer reply:", error);
      return;
    }
    try {
      const guild = await client.guilds.fetch(config.discord.guildId);
      const events = await guild.scheduledEvents.fetch({
        withUserCount: false,
      });
      console.log(`[Sync] Found ${events.size} events`);
      const count = await bulkSyncEvents(events);
      console.log(`[Sync] Synced ${count} events`);
      await interaction.editReply(`Synced ${count} events to Google Calendar`);
    } catch (error) {
      console.error("[Sync] Bulk sync failed:", error);
      await interaction.editReply(
        "Failed to sync events. Check logs for details.",
      );
    }
  }

  if (interaction.commandName === "cleanup-calendar") {
    console.log("[Cleanup] /cleanup-calendar command received");
    try {
      await interaction.deferReply({ ephemeral: true });
    } catch (error) {
      console.error("[Cleanup] Failed to defer reply:", error);
      return;
    }
    try {
      const guild = await client.guilds.fetch(config.discord.guildId);
      const discordEvents = await guild.scheduledEvents.fetch({
        withUserCount: false,
      });
      const result = await cleanupOrphanedEvents(discordEvents);
      console.log(
        `[Cleanup] Deleted ${result.deleted} orphaned events, kept ${result.kept}`,
      );
      await interaction.editReply(
        `Cleanup complete: deleted ${result.deleted} orphaned Google Calendar events, kept ${result.kept} valid events.`,
      );
    } catch (error) {
      console.error("[Cleanup] Cleanup failed:", error);
      await interaction.editReply(
        "Failed to cleanup events. Check logs for details.",
      );
    }
  }

  if (interaction.commandName === "list-mappings") {
    console.log("[Mappings] /list-mappings command received");
    try {
      await interaction.deferReply({ ephemeral: true });
    } catch (error) {
      console.error("[Mappings] Failed to defer reply:", error);
      return;
    }
    try {
      const mappings = getAllMappings(config.discord.guildId);
      if (mappings.length === 0) {
        await interaction.editReply("No event mappings found.");
        return;
      }
      const lines = mappings.map(
        (m) =>
          `Discord: \`${m.discord_event_id}\` → GCal: \`${m.google_event_id}\``,
      );
      const response =
        `**${mappings.length} event mappings:**\n` + lines.join("\n");
      // Discord has a 2000 char limit
      await interaction.editReply(
        response.length > 1900
          ? response.slice(0, 1900) + "\n... (truncated)"
          : response,
      );
    } catch (error) {
      console.error("[Mappings] List mappings failed:", error);
      await interaction.editReply(
        "Failed to list mappings. Check logs for details.",
      );
    }
  }

  if (interaction.commandName === "list-feeds") {
    console.log("[RSS] /list-feeds command received");
    try {
      await interaction.deferReply({ ephemeral: true });
    } catch (error) {
      console.error("[RSS] Failed to defer reply:", error);
      return;
    }
    try {
      const feeds = loadFeedUrls();
      if (feeds.length === 0) {
        await interaction.editReply("No RSS feeds configured.");
        return;
      }
      const lines = feeds.map((url) => `• ${url}`);
      const response = `**${feeds.length} RSS feeds:**\n` + lines.join("\n");
      await interaction.editReply(
        response.length > 1900
          ? response.slice(0, 1900) + "\n... (truncated)"
          : response,
      );
    } catch (error) {
      console.error("[RSS] List feeds failed:", error);
      await interaction.editReply(
        "Failed to list feeds. Check logs for details.",
      );
    }
  }

  if (interaction.commandName === "refresh-feeds") {
    console.log("[RSS] /refresh-feeds command received");
    try {
      await interaction.deferReply({ ephemeral: true });
    } catch (error) {
      console.error("[RSS] Failed to defer reply:", error);
      return;
    }
    try {
      await syncFeeds(client);
      await interaction.editReply(
        "RSS feeds refreshed. New entries posted to channel.",
      );
    } catch (error) {
      console.error("[RSS] Refresh feeds failed:", error);
      await interaction.editReply(
        "Failed to refresh feeds. Check logs for details.",
      );
    }
  }

  if (
    interaction.commandName === "tickets" ||
    interaction.commandName === "tickets-share"
  ) {
    console.log(`[GitHub] /${interaction.commandName} command received`);
    // /tickets-share posts visibly to the channel; /tickets is just for you
    const isPublic = interaction.commandName === "tickets-share";
    try {
      await interaction.deferReply({ ephemeral: !isPublic });
    } catch (error) {
      console.error("[GitHub] Failed to defer reply:", error);
      return;
    }
    try {
      // Only ever show the caller their own account, so nobody can
      // pull up someone else's task list
      const username = getGithubUsername(interaction.user.username);
      if (!username) {
        await interaction.editReply(
          "I don't know your GitHub username. Add yourself to `config/people.yml` in the donna-bot repo (PR welcome).",
        );
        return;
      }
      const { issues, totalCount } = await fetchOpenIssues(username);
      if (issues.length === 0) {
        await interaction.editReply(
          `No open issues assigned to \`${username}\` in the ${config.github.org} org. Enjoy the peace!`,
        );
        return;
      }
      const shown =
        issues.length < totalCount
          ? `most recently updated ${issues.length} of ${totalCount}`
          : `${totalCount}`;
      let header = `**${shown} open issue${totalCount === 1 ? "" : "s"} assigned to \`${username}\`:**`;
      if (totalCount > MAX_HEALTHY_ASSIGNED) {
        header += `\n⚠️ That's more than ${MAX_HEALTHY_ASSIGNED}. Consider finishing or unassigning a few before picking up more.`;
      }
      await interaction.editReply(
        joinLinesWithinLimit(header, formatIssueLines(issues)),
      );
    } catch (error) {
      console.error("[GitHub] Tickets lookup failed:", error);
      await interaction.editReply(
        "Failed to fetch issues from GitHub. Check logs for details.",
      );
    }
  }
});

client.on("error", (error) => {
  console.error("[Bot] Client error:", error);
});

async function main(): Promise<void> {
  console.log("[Bot] Starting donna-bot...");
  initDatabase();
  initRssDatabase();
  await client.login(config.discord.token);
}

main().catch((error) => {
  console.error("[Bot] Fatal error:", error);
  process.exit(1);
});
