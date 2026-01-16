import { GuildScheduledEventRecurrenceRule } from "discord.js";

// Discord frequency values
// 0 = YEARLY, 1 = MONTHLY, 2 = WEEKLY, 3 = DAILY
const FREQUENCY_MAP: Record<number, string> = {
  0: "YEARLY",
  1: "MONTHLY",
  2: "WEEKLY",
  3: "DAILY",
};

// Discord weekday values: 0 = Monday, 6 = Sunday
// iCal weekday abbreviations
const WEEKDAY_MAP: Record<number, string> = {
  0: "MO",
  1: "TU",
  2: "WE",
  3: "TH",
  4: "FR",
  5: "SA",
  6: "SU",
};

export function convertRecurrenceRule(
  rule: GuildScheduledEventRecurrenceRule | null
): string[] {
  if (!rule) return [];

  const parts: string[] = [];

  // Frequency (required)
  const freq = FREQUENCY_MAP[rule.frequency];
  if (!freq) {
    console.warn(`[Recurrence] Unknown frequency: ${rule.frequency}`);
    return [];
  }
  parts.push(`FREQ=${freq}`);

  // Interval
  if (rule.interval && rule.interval > 1) {
    parts.push(`INTERVAL=${rule.interval}`);
  }

  // By weekday (for WEEKLY/DAILY)
  if (rule.byWeekday && rule.byWeekday.length > 0) {
    const days = rule.byWeekday
      .map((day) => WEEKDAY_MAP[day])
      .filter(Boolean)
      .join(",");
    if (days) {
      parts.push(`BYDAY=${days}`);
    }
  }

  // By nth weekday (for MONTHLY - e.g., "4th Wednesday")
  if (rule.byNWeekday && rule.byNWeekday.length > 0) {
    const nthDays = rule.byNWeekday
      .map((nw) => {
        const day = WEEKDAY_MAP[nw.day];
        if (!day) return null;
        return `${nw.n}${day}`;
      })
      .filter(Boolean)
      .join(",");
    if (nthDays) {
      parts.push(`BYDAY=${nthDays}`);
    }
  }

  // By month (for YEARLY)
  if (rule.byMonth && rule.byMonth.length > 0) {
    parts.push(`BYMONTH=${rule.byMonth.join(",")}`);
  }

  // By month day (for MONTHLY)
  if (rule.byMonthDay && rule.byMonthDay.length > 0) {
    parts.push(`BYMONTHDAY=${rule.byMonthDay.join(",")}`);
  }

  // Count (number of occurrences)
  if (rule.count) {
    parts.push(`COUNT=${rule.count}`);
  }

  // End date
  if (rule.endAt) {
    // Format as YYYYMMDDTHHMMSSZ
    const endDate = new Date(rule.endAt);
    const formatted = endDate
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
    parts.push(`UNTIL=${formatted}`);
  }

  if (parts.length === 1) {
    // Only frequency, no other rules - still valid
    return [`RRULE:${parts.join(";")}`];
  }

  return [`RRULE:${parts.join(";")}`];
}
