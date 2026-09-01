import { readFileSync, existsSync } from "fs";
import { parse } from "yaml";
import { config } from "../config.js";
import { isValidGithubUsername } from "../github/api.js";

export interface Person {
  name: string;
  discord: string;
  github: string;
}

// Parse the people.yml format: a YAML list of {name, discord, github}.
// Invalid entries are skipped with a log line rather than crashing the bot,
// since the file is hand-edited.
export function parsePeople(content: string): Person[] {
  let parsed: unknown;
  try {
    parsed = parse(content);
  } catch (error) {
    console.error("[People] people file is not valid YAML:", error);
    return [];
  }
  if (parsed === null || parsed === undefined) return [];
  if (!Array.isArray(parsed)) {
    console.log("[People] people file is not a YAML list, ignoring");
    return [];
  }

  const people: Person[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const { name, discord, github } = entry as Record<string, unknown>;
    if (typeof discord !== "string" || discord.trim() === "") {
      console.log(
        `[People] Skipping entry with missing discord username: ${JSON.stringify(entry)}`,
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
      discord: discord.trim(),
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
// without a restart when running under tsx/dev.
// Case-insensitive: Discord usernames are lowercase, but be forgiving
// about how people write them in the file.
export function getGithubUsername(discordUsername: string): string | null {
  const wanted = discordUsername.toLowerCase();
  return (
    loadPeople().find((p) => p.discord.toLowerCase() === wanted)?.github ?? null
  );
}
