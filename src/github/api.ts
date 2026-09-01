import { config } from "../config.js";

export interface GithubIssue {
  title: string;
  htmlUrl: string;
  repoName: string; // e.g. "donna-bot"
  number: number;
}

export interface OpenIssuesResult {
  issues: GithubIssue[];
  totalCount: number; // true total from the API; issues may be capped below this
}

// GitHub usernames: alphanumerics and hyphens, max 39 chars
export function isValidGithubUsername(username: string): boolean {
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username);
}

interface SearchResultItem {
  title: string;
  html_url: string;
  number: number;
  repository_url: string; // https://api.github.com/repos/<owner>/<repo>
}

// Open issues in the configured org assigned to the user, most recently
// updated first. Capped at 50; totalCount carries the real number.
export async function fetchOpenIssues(
  githubUsername: string,
): Promise<OpenIssuesResult> {
  if (!isValidGithubUsername(githubUsername)) {
    throw new Error(`Invalid GitHub username: ${githubUsername.slice(0, 50)}`);
  }

  const url = new URL("https://api.github.com/search/issues");
  url.searchParams.set(
    "q",
    `org:${config.github.org} is:issue is:open assignee:${githubUsername}`,
  );
  url.searchParams.set("sort", "updated");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", "50");

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "donna-bot/1.0",
  };
  if (config.github.token) {
    headers.Authorization = `Bearer ${config.github.token}`;
  }

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    // Body says whether this is rate limiting vs a bad token
    const body = (await response.text()).slice(0, 200);
    throw new Error(`GitHub API returned ${response.status}: ${body}`);
  }

  const body = (await response.json()) as {
    total_count?: number;
    items?: SearchResultItem[];
  };
  const items = body.items ?? [];

  return {
    totalCount: body.total_count ?? items.length,
    issues: items.map((item) => ({
      title: item.title,
      htmlUrl: item.html_url,
      repoName: item.repository_url.split("/").pop() ?? "",
      number: item.number,
    })),
  };
}

// Titles are attacker-controlled text going into [text](<url>) markdown;
// unescaped brackets break the link or let a title redirect it
function escapeMarkdown(text: string): string {
  return text.replace(/[\\[\]()`]/g, (c) => "\\" + c);
}

// Discord message lines for a list of issues, grouped by repo
export function formatIssueLines(issues: GithubIssue[]): string[] {
  const byRepo = new Map<string, GithubIssue[]>();
  for (const issue of issues) {
    const list = byRepo.get(issue.repoName) ?? [];
    list.push(issue);
    byRepo.set(issue.repoName, list);
  }

  const lines: string[] = [];
  for (const [repo, repoIssues] of [...byRepo.entries()].sort()) {
    lines.push(`**${repo}**`);
    for (const issue of repoIssues.sort((a, b) => a.number - b.number)) {
      lines.push(
        `• [#${issue.number} ${escapeMarkdown(issue.title)}](<${issue.htmlUrl}>)`,
      );
    }
  }
  return lines;
}

// Join lines into a Discord-safe message, never splitting a line. Lines
// that don't fit are dropped and counted in a trailing note.
export function joinLinesWithinLimit(
  header: string,
  lines: string[],
  limit = 1900,
): string {
  let response = header;
  let dropped = 0;
  for (const line of lines) {
    if (dropped === 0 && response.length + line.length + 1 <= limit) {
      response += "\n" + line;
    } else {
      dropped++;
    }
  }
  if (dropped > 0) {
    response += `\n... and ${dropped} more (list too long for Discord)`;
  }
  return response;
}
