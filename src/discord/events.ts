import { Client, Events } from "discord.js";
import {
  syncEventToCalendar,
  deleteEventFromCalendar,
} from "../sync/eventSync.js";
import { config } from "../config.js";

export function registerEventHandlers(client: Client): void {
  client.on(Events.GuildScheduledEventCreate, async (event) => {
    console.log(`[Discord] Event created: ${event.name} (${event.id})`);
    if (config.disableAutoSync) {
      console.log("[Discord] Auto-sync disabled, skipping");
      return;
    }
    try {
      await syncEventToCalendar(event, "create");
    } catch (error) {
      console.error(
        `[Discord] Failed to sync created event ${event.id}:`,
        error,
      );
    }
  });

  client.on(Events.GuildScheduledEventUpdate, async (oldEvent, newEvent) => {
    console.log(`[Discord] Event updated: ${newEvent.name} (${newEvent.id})`);
    if (config.disableAutoSync) {
      console.log("[Discord] Auto-sync disabled, skipping");
      return;
    }
    try {
      await syncEventToCalendar(newEvent, "update");
    } catch (error) {
      console.error(
        `[Discord] Failed to sync updated event ${newEvent.id}:`,
        error,
      );
    }
  });

  client.on(Events.GuildScheduledEventDelete, async (event) => {
    // Handle partial events - name may be null
    const eventName = event.name || "Unknown";
    console.log(`[Discord] Event deleted: ${eventName} (${event.id})`);
    if (config.disableAutoSync) {
      console.log("[Discord] Auto-sync disabled, skipping");
      return;
    }
    try {
      await deleteEventFromCalendar(event.id);
    } catch (error) {
      console.error(`[Discord] Failed to delete event ${event.id}:`, error);
    }
  });
}
