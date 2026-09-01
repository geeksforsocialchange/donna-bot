import { readFileSync, existsSync } from "fs";
import { parse } from "yaml";
import { config } from "../config.js";
import { isValidGithubUsername } from "../github/api.js";

export interface Person {
  name: string;
  discordId: string;
  github: string;
}

// Parse the people.yml format: a YAML list of {name, discord_id, github}.
// Invalid entries are skipped with a log line rather than crashing the bot,
// since the file is hand-edited.
export function parsePeople(content: string): Person[] {
  const parsed: unknown = parse(content);
  if (parsed === null || parsed === undefined) return [];
  if (!Array.isArray(parsed)) {
    console.log("[People] people file is not a YAML list, ignoring");
    return [];
  }

  const people: Person[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const { name, discord_id, github } = entry as Record<string, unknown>;
    if (typeof discord_id !== "string") {
      // Unquoted Discord IDs parse as numbers and lose precision (they
      // exceed 2^53), so only quoted strings are accepted
      console.log(
        `[People] Skipping entry with missing or unquoted discord_id: ${JSON.stringify(entry)}`,
      );
      continue;
    }
    if (typeof github !== "string" || !isValidGithubUsername(github)) {
      console.log(
        `[People] Skipping entry with invalid github username: ${JSON.stringify(entry)}`,
      );
      continue;
    }
    people.push({
      name: typeof name === "string" ? name : github,
      discordId: discord_id,
      github,
    });
  }
  return people;
}

export function loadPeople(): Person[] {
  const peoplePath = config.people.path;
  if (!existsSync(peoplePath)) {
    console.log(`[People] People file not found at ${peoplePath}`);
    return [];
  }
  return parsePeople(readFileSync(peoplePath, "utf-8"));
}

// Re-read on every lookup: the file is tiny and this picks up edits
// without a restart when running under tsx/dev
export function getGithubUsername(discordId: string): string | null {
  return loadPeople().find((p) => p.discordId === discordId)?.github ?? null;
}
