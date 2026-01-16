import { google, calendar_v3 } from "googleapis";
import { config } from "../config.js";

let calendarClient: calendar_v3.Calendar | null = null;

function getCalendarClient(): calendar_v3.Calendar {
  if (calendarClient) return calendarClient;

  const keyJson = Buffer.from(config.google.serviceAccountKey, "base64").toString("utf-8");
  const credentials = JSON.parse(keyJson);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  calendarClient = google.calendar({ version: "v3", auth });
  return calendarClient;
}

export interface CalendarEventInput {
  summary: string;
  description?: string;
  location?: string;
  start: Date;
  end?: Date;
  recurrence?: string[];
}

export async function createCalendarEvent(event: CalendarEventInput): Promise<string> {
  const calendar = getCalendarClient();

  const eventBody: calendar_v3.Schema$Event = {
    summary: event.summary,
    description: event.description,
    location: event.location,
    start: {
      dateTime: event.start.toISOString(),
      timeZone: "UTC",
    },
    end: {
      dateTime: (event.end || new Date(event.start.getTime() + 3600000)).toISOString(),
      timeZone: "UTC",
    },
  };

  if (event.recurrence && event.recurrence.length > 0) {
    eventBody.recurrence = event.recurrence;
  }

  const response = await calendar.events.insert({
    calendarId: config.google.calendarId,
    requestBody: eventBody,
  });

  if (!response.data.id) {
    throw new Error("Failed to create calendar event: no ID returned");
  }

  console.log(`[GCal] Created event: ${response.data.id}`);
  return response.data.id;
}

export async function updateCalendarEvent(
  googleEventId: string,
  event: CalendarEventInput
): Promise<void> {
  const calendar = getCalendarClient();

  const eventBody: calendar_v3.Schema$Event = {
    summary: event.summary,
    description: event.description,
    location: event.location,
    start: {
      dateTime: event.start.toISOString(),
      timeZone: "UTC",
    },
    end: {
      dateTime: (event.end || new Date(event.start.getTime() + 3600000)).toISOString(),
      timeZone: "UTC",
    },
  };

  if (event.recurrence && event.recurrence.length > 0) {
    eventBody.recurrence = event.recurrence;
  }

  await calendar.events.update({
    calendarId: config.google.calendarId,
    eventId: googleEventId,
    requestBody: eventBody,
  });

  console.log(`[GCal] Updated event: ${googleEventId}`);
}

export async function deleteCalendarEvent(googleEventId: string): Promise<void> {
  const calendar = getCalendarClient();

  await calendar.events.delete({
    calendarId: config.google.calendarId,
    eventId: googleEventId,
  });

  console.log(`[GCal] Deleted event: ${googleEventId}`);
}
