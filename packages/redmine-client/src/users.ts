import type { RedmineHttp } from "./http.js";
import type { RedmineConfig } from "./config.js";
import type { RedmineUser, SearchUsersResult } from "./types.js";

type RawUserRow = {
  id: number;
  login: string;
  firstname?: string;
  lastname?: string;
};

type RawUsersResponse = {
  users: RawUserRow[];
  total_count: number;
  offset?: number;
  limit?: number;
};

export function normalizeListedUser(raw: RawUserRow): RedmineUser {
  const name = [raw.lastname, raw.firstname].filter(Boolean).join(" ").trim();
  return {
    id: raw.id,
    login: raw.login,
    name: name || raw.login,
  };
}

function compact(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

export async function searchUsers(
  http: RedmineHttp,
  config: RedmineConfig,
  opts: { query?: string; limit?: number } = {}
): Promise<SearchUsersResult> {
  const wanted = Math.min(
    opts.limit ?? Math.min(50, config.maxResultCount),
    config.maxResultCount
  );
  const query: Record<string, string | number | undefined> = {
    limit: wanted,
    offset: 0,
    status: 1,
  };
  if (opts.query?.trim()) {
    query.name = opts.query.trim();
  }

  const page = await http.getJson<RawUsersResponse>("/users.json", query);
  let users = (page.users ?? []).map(normalizeListedUser);

  if (opts.query?.trim()) {
    const q = compact(opts.query);
    users = users.filter(
      (u) =>
        compact(u.name).includes(q) ||
        compact(u.login).includes(q) ||
        compact(`${u.name}${u.login}`).includes(q)
    );
  }

  return {
    users: users.slice(0, wanted),
    totalCount: page.total_count ?? users.length,
    returnedCount: Math.min(users.length, wanted),
  };
}
