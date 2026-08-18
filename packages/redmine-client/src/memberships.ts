import type { RedmineHttp } from "./http.js";
import { RedmineError } from "./errors.js";
import { searchIssues } from "./issues.js";
import type { RedmineConfig } from "./config.js";
import type {
  ListProjectMembersResult,
  RedmineUser,
} from "./types.js";

type RawMembership = {
  id: number;
  project?: { id: number; name: string };
  user?: { id: number; name: string } | null;
  group?: { id: number; name: string } | null;
  roles?: Array<{ id: number; name: string }>;
};

type RawMembershipsResponse = {
  memberships: RawMembership[];
  total_count: number;
  offset?: number;
  limit?: number;
};

function compact(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

export async function listProjectMembers(
  http: RedmineHttp,
  config: RedmineConfig,
  opts: { projectId: number; query?: string; limit?: number }
): Promise<ListProjectMembersResult> {
  const wanted = Math.min(
    opts.limit ?? Math.min(200, config.maxResultCount),
    config.maxResultCount
  );
  const pageSize = Math.min(100, wanted);
  const byId = new Map<number, RedmineUser>();
  let offset = 0;
  let totalCount = 0;

  while (byId.size < wanted) {
    const page = await http.getJson<RawMembershipsResponse>(
      `/projects/${opts.projectId}/memberships.json`,
      { limit: pageSize, offset }
    );
    totalCount = page.total_count ?? page.memberships.length;
    for (const m of page.memberships ?? []) {
      if (!m.user) continue;
      byId.set(m.user.id, {
        id: m.user.id,
        login: String(m.user.id),
        name: m.user.name,
      });
    }
    offset += page.memberships?.length ?? 0;
    if (!page.memberships?.length || offset >= totalCount) break;
  }

  let members = [...byId.values()];
  if (opts.query?.trim()) {
    const q = compact(opts.query);
    members = members.filter((u) => compact(u.name).includes(q));
  }
  members = members.slice(0, wanted);

  return {
    projectId: opts.projectId,
    members,
    totalCount: byId.size,
    returnedCount: members.length,
  };
}

export function matchMemberByName(
  members: RedmineUser[],
  name: string
): RedmineUser[] {
  const q = compact(name);
  const exact = members.filter((u) => compact(u.name) === q);
  if (exact.length > 0) return exact;
  return members.filter((u) => compact(u.name).includes(q));
}

/**
 * 담당자·일감관리자 후보. 이 Redmine처럼 멤버 목록(그리고 전체 사용자 검색)이
 * 403인 인스턴스도 있어서, 막히면 최근 이슈의 담당자에서 후보를 추립니다.
 * 읽을 수 있는 것만 쓰므로 권한이 좁은 계정에서도 이름 해석이 동작합니다.
 */
export async function listProjectPeople(
  http: RedmineHttp,
  config: RedmineConfig,
  opts: { projectId: number; query?: string; limit?: number }
): Promise<ListProjectMembersResult> {
  try {
    const result = await listProjectMembers(http, config, opts);
    return { ...result, source: "memberships" };
  } catch (err) {
    if (
      !(err instanceof RedmineError) ||
      err.code !== "REDMINE_PERMISSION_DENIED"
    ) {
      throw err;
    }
  }

  const { issues } = await searchIssues(http, config, {
    projectId: opts.projectId,
    status: "all",
    limit: 100,
  });
  const byId = new Map<number, RedmineUser>();
  for (const issue of issues) {
    if (!issue.assignedTo) continue;
    byId.set(issue.assignedTo.id, {
      id: issue.assignedTo.id,
      login: String(issue.assignedTo.id),
      name: issue.assignedTo.name,
    });
  }

  let people = [...byId.values()];
  if (opts.query?.trim()) {
    const q = compact(opts.query);
    people = people.filter((u) => compact(u.name).includes(q));
  }
  if (opts.limit) people = people.slice(0, opts.limit);

  return {
    projectId: opts.projectId,
    members: people,
    totalCount: byId.size,
    returnedCount: people.length,
    source: "issues",
  };
}
