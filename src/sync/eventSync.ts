import {
  Collection,
  GuildScheduledEvent,
  GuildScheduledEventStatus,
} from "discord.js";
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  listCalendarEvents,
  CalendarEventInput,
} from "../google/calendar.js";
import {
  saveMapping,
  getMapping,
  deleteMapping,
  getAllMappings,
} from "../db/mappings.js";
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
    ? `${eventDescription}<br><br>---<br><a href="${discordLink}">Discord Event Link</a>`
    : `<a href="${discordLink}">Discord Event Link</a>`;

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

/**
 * Cleanup orphaned Google Calendar events that don't have a corresponding Discord event.
 * This handles duplicates created when both dev and prod instances sync the same events.
 */
export async function cleanupOrphanedEvents(
  discordEvents: Collection<string, GuildScheduledEvent>,
): Promise<{ deleted: number; kept: number }> {
  // Get all Google Calendar events
  const calendarEvents = await listCalendarEvents();
  console.log(
    `[Cleanup] Found ${calendarEvents.length} Google Calendar events`,
  );

  // Get all known mappings from our database
  const mappings = getAllMappings();
  const knownGoogleIds = new Set(mappings.map((m) => m.google_event_id));

  // Build set of valid Discord event IDs (active events only)
  const validDiscordIds = new Set<string>();
  for (const [id, event] of discordEvents) {
    if (
      event.status !== GuildScheduledEventStatus.Canceled &&
      event.status !== GuildScheduledEventStatus.Completed
    ) {
      validDiscordIds.add(id);
    }
  }

  let deleted = 0;
  let kept = 0;

  for (const calEvent of calendarEvents) {
    // Check if this calendar event contains a Discord event link
    const discordLinkMatch = calEvent.description?.match(
      /discord\.com\/events\/\d+\/(\d+)/,
    );

    if (!discordLinkMatch) {
      // Not a donna-bot created event, skip
      kept++;
      continue;
    }

    const discordEventId = discordLinkMatch[1];

    // Check if this Discord event still exists and is valid
    if (validDiscordIds.has(discordEventId)) {
      // Check if this is the "canonical" calendar event (in our mappings)
      if (knownGoogleIds.has(calEvent.id)) {
        // This is the mapped event, keep it
        kept++;
        continue;
      }
      // This is a duplicate - same Discord event but not in our mappings
      console.log(
        `[Cleanup] Deleting duplicate: ${calEvent.summary} (GCal: ${calEvent.id}, Discord: ${discordEventId})`,
      );
    } else {
      // Discord event no longer exists or is cancelled/completed
      console.log(
        `[Cleanup] Deleting orphaned: ${calEvent.summary} (GCal: ${calEvent.id}, Discord: ${discordEventId})`,
      );
      // Also clean up the mapping if it exists
      deleteMapping(discordEventId);
    }

    try {
      await deleteCalendarEvent(calEvent.id);
      deleted++;
    } catch (error) {
      if ((error as { code?: number }).code === 404) {
        console.log(`[Cleanup] Already deleted: ${calEvent.id}`);
        deleted++;
      } else {
        console.error(`[Cleanup] Failed to delete ${calEvent.id}:`, error);
      }
    }
  }

  return { deleted, kept };
}
