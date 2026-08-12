import { config } from "../config.js";

export interface GithubIssue {
  title: string;
  htmlUrl: string;
  repoName: string; // e.g. "donna-bot"
  number: number;
  isAssigned: boolean;
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

async function searchIssues(query: string): Promise<SearchResultItem[]> {
  const url = new URL("https://api.github.com/search/issues");
  url.searchParams.set("q", query);
  url.searchParams.set("per_page", "50");

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "donna-bot/1.0",
  };
  if (config.github.token) {
    headers.Authorization = `Bearer ${config.github.token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(
      `GitHub API returned ${response.status} for query "${query}"`,
    );
  }

  const body = (await response.json()) as { items?: SearchResultItem[] };
  return body.items ?? [];
}

// Open issues in the configured org that the user authored or is assigned to
export async function fetchOpenIssues(
  githubUsername: string,
): Promise<GithubIssue[]> {
  const org = config.github.org;
  const base = `org:${org} is:issue is:open`;

  const [authored, assigned] = await Promise.all([
    searchIssues(`${base} author:${githubUsername}`),
    searchIssues(`${base} assignee:${githubUsername}`),
  ]);

  const assignedUrls = new Set(assigned.map((i) => i.html_url));
  const byUrl = new Map<string, SearchResultItem>();
  for (const item of [...authored, ...assigned]) {
    byUrl.set(item.html_url, item);
  }

  return [...byUrl.values()].map((item) => ({
    title: item.title,
    htmlUrl: item.html_url,
    repoName: item.repository_url.split("/").pop() ?? "",
    number: item.number,
    isAssigned: assignedUrls.has(item.html_url),
  }));
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
      const assigned = issue.isAssigned ? " (assigned)" : "";
      lines.push(`• [#${issue.number} ${issue.title}](<${issue.htmlUrl}>)${assigned}`);
    }
  }
  return lines;
}
