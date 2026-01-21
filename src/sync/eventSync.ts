import {
  Collection,
  GuildScheduledEvent,
  GuildScheduledEventStatus,
} from "discord.js";
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  CalendarEventInput,
} from "../google/calendar.js";
import { saveMapping, getMapping, deleteMapping } from "../db/mappings.js";
import { convertRecurrenceRule } from "./recurrence.js";

function discordEventToCalendarInput(
  event: GuildScheduledEvent,
): CalendarEventInput {
  const start = event.scheduledStartAt;
  if (!start) {
    throw new Error(`Event ${event.id} has no start time`);
  }

  const end = event.scheduledEndAt || new Date(start.getTime() + 3600000); // Default 1 hour

  // Build description with Discord event link
  // Google Calendar uses HTML for descriptions, so convert newlines to <br>
  const discordLink = `https://discord.com/events/${event.guildId}/${event.id}`;
  const eventDescription = event.description
    ? event.description.replace(/\n/g, "<br>")
    : "";
  const description = eventDescription
    ? `${eventDescription}<br><br>---<br>Discord Event: ${discordLink}`
    : `Discord Event: ${discordLink}`;

  // Get location from entity metadata (for external events)
  const location = event.entityMetadata?.location || undefined;

  // Convert recurrence rule if present
  const recurrence = convertRecurrenceRule(event.recurrenceRule);

  return {
    summary: event.name,
    description,
    location,
    start,
    end,
    recurrence,
  };
}

export async function syncEventToCalendar(
  event: GuildScheduledEvent,
  action: "create" | "update",
): Promise<void> {
  // Skip cancelled or completed events
  if (
    event.status === GuildScheduledEventStatus.Canceled ||
    event.status === GuildScheduledEventStatus.Completed
  ) {
    console.log(`[Sync] Skipping ${event.status} event: ${event.name}`);
    return;
  }

  const calendarInput = discordEventToCalendarInput(event);
  const existingMapping = getMapping(event.id);

  if (action === "create" || !existingMapping) {
    // Create new calendar event
    const googleEventId = await createCalendarEvent(calendarInput);
    saveMapping(event.id, googleEventId, event.guildId);
    console.log(`[Sync] Created mapping: ${event.id} -> ${googleEventId}`);
  } else {
    // Update existing calendar event
    await updateCalendarEvent(existingMapping.google_event_id, calendarInput);
    console.log(`[Sync] Updated event: ${existingMapping.google_event_id}`);
  }
}

export async function deleteEventFromCalendar(
  discordEventId: string,
): Promise<void> {
  const mapping = getMapping(discordEventId);

  if (!mapping) {
    console.log(`[Sync] No mapping found for Discord event ${discordEventId}`);
    return;
  }

  try {
    await deleteCalendarEvent(mapping.google_event_id);
  } catch (error) {
    // Event might already be deleted from Google Calendar
    if ((error as { code?: number }).code === 404) {
      console.log(
        `[Sync] Google event already deleted: ${mapping.google_event_id}`,
      );
    } else {
      throw error;
    }
  }

  deleteMapping(discordEventId);
  console.log(`[Sync] Deleted mapping: ${discordEventId}`);
}

export async function bulkSyncEvents(
  events: Collection<string, GuildScheduledEvent>,
): Promise<number> {
  let synced = 0;

  for (const [, event] of events) {
    try {
      // Skip cancelled or completed events
      if (
        event.status === GuildScheduledEventStatus.Canceled ||
        event.status === GuildScheduledEventStatus.Completed
      ) {
        continue;
      }

      const existingMapping = getMapping(event.id);
      await syncEventToCalendar(event, existingMapping ? "update" : "create");
      synced++;
    } catch (error) {
      console.error(`[Sync] Failed to sync event ${event.id}:`, error);
    }
  }

  return synced;
}
