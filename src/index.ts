import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import { config } from "./config.js";
import { registerEventHandlers } from "./discord/events.js";
import { initDatabase } from "./db/mappings.js";
import { bulkSyncEvents } from "./sync/eventSync.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildScheduledEvents],
});

async function registerCommands(): Promise<void> {
  const commands = [
    new SlashCommandBuilder()
      .setName("sync-events")
      .setDescription("Manually sync all Discord events to Google Calendar"),
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
  await registerCommands();
  registerEventHandlers(client);
  console.log("[Bot] Ready and listening for scheduled events");
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "sync-events") {
    console.log("[Sync] /sync command received");
    try {
      await interaction.deferReply({ ephemeral: true });
      console.log("[Sync] Deferred reply sent");
    } catch (error) {
      console.error("[Sync] Failed to defer reply:", error);
      return;
    }
    try {
      console.log("[Sync] Fetching guild...");
      const guild = await client.guilds.fetch(config.discord.guildId);
      console.log("[Sync] Fetching events...");
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
});

client.on("error", (error) => {
  console.error("[Bot] Client error:", error);
});

async function main(): Promise<void> {
  console.log("[Bot] Starting donna-bot...");
  initDatabase();
  await client.login(config.discord.token);
}

main().catch((error) => {
  console.error("[Bot] Fatal error:", error);
  process.exit(1);
});
