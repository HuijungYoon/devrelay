import type { RedmineClient, RedmineUser } from "redmine-devrelay-client";
import { RedmineError, matchMemberByName } from "redmine-devrelay-client";
import type { GetIssueInput, SearchIssuesInput } from "./schemas.js";
import { resolveNamedRef } from "./metadata.js";

function compact(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

/**
 * 검색 필터의 사람 값: "me" | id | 이름. 이름은 프로젝트 멤버(있으면)에서, 없으면
 * 전체 사용자 검색(권한 필요)에서 찾는다. 못 찾거나 여럿이면 후보와 함께 거절.
 */
export async function resolveUserFilter(
  client: RedmineClient,
  projectId: number | undefined,
  value: "me" | number | string,
  field: string
): Promise<{ id: "me" | number; label?: string }> {
  if (value === "me") return { id: "me" };
  if (typeof value === "number") return { id: value };
  const query = value.trim();
  if (/^\d+$/.test(query)) return { id: Number(query) };
  if (!query) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: `${field} must be "me", a user id or a name`,
      check: [`Pass "me", a numeric id, or a name for ${field}`],
    });
  }

  let pool: RedmineUser[] = [];
  if (projectId !== undefined) {
    const { members } = await client.listProjectPeople({ projectId, limit: 500 });
    pool = matchMemberByName(members, query);
  }
  if (pool.length === 0) {
    try {
      const { users } = await client.searchUsers({ query, limit: 50 });
      const q = compact(query);
      const exact = users.filter(
        (u) => compact(u.name) === q || compact(u.login) === q
      );
      pool = exact.length > 0 ? exact : users;
    } catch {
      /* users API may be forbidden — fall through to the error below */
    }
  }
  if (pool.length === 0) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: `No user matched ${field}="${query}"`,
      check: [
        projectId === undefined
          ? "Pass projectId so members can be matched, or a numeric user id"
          : "Call redmine_list_project_members and pick an id",
      ],
    });
  }
  if (pool.length > 1) {
    const sample = pool.slice(0, 8).map((u) => `${u.id}:${u.name}`).join(", ");
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: `Ambiguous ${field}="${query}" — matches: ${sample}`,
      check: ["Pass the numeric user id"],
    });
  }
  return { id: pool[0].id, label: pool[0].name };
}

function requireProjectForName(
  field: string,
  value: unknown,
  projectId: number | undefined
): void {
  if (typeof value === "string" && !/^\d+$/.test(value) && projectId === undefined) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: `${field}="${value}" is a name, which needs projectId to resolve (versions and categories are per project)`,
      check: ["Pass projectId, or the numeric id instead of the name"],
    });
  }
}

/**
 * 검색. 유형·우선순위·상태·버전·범주·사람은 이름을 받아 id로 바꾼 뒤 클라이언트에 넘긴다.
 * 무엇으로 해석했는지 `resolved`에 라벨로 돌려준다.
 */
export async function handleSearchIssues(
  client: RedmineClient,
  input: SearchIssuesInput
) {
  const resolved: Record<string, string> = {};
  const out: Record<string, unknown> = {};

  const passthrough = [
    "projectId",
    "issueId",
    "subjectContains",
    "createdAfter",
    "createdBefore",
    "updatedAfter",
    "updatedBefore",
    "dueAfter",
    "dueBefore",
    "parentIssueId",
    "customFields",
    "sort",
    "limit",
    "offset",
  ] as const;
  for (const key of passthrough) {
    if (input[key] !== undefined) out[key] = input[key];
  }

  if (input.trackerId !== undefined) {
    const r = await resolveNamedRef(client, "trackers", input.trackerId, "trackerId");
    out.trackerId = r.id;
    if (r.label) resolved.tracker = r.label;
  }
  if (input.priorityId !== undefined) {
    const r = await resolveNamedRef(client, "priorities", input.priorityId, "priorityId");
    out.priorityId = r.id;
    if (r.label) resolved.priority = r.label;
  }
  if (input.status !== undefined) {
    if (
      input.status === "open" ||
      input.status === "closed" ||
      input.status === "all" ||
      typeof input.status === "number"
    ) {
      out.status = input.status;
    } else {
      const r = await resolveNamedRef(client, "statuses", input.status, "status");
      out.status = r.id;
      if (r.label) resolved.status = r.label;
    }
  }
  if (input.fixedVersionId !== undefined) {
    requireProjectForName("fixedVersionId", input.fixedVersionId, input.projectId);
    const r = await resolveNamedRef(
      client,
      "versions",
      input.fixedVersionId,
      "fixedVersionId",
      input.projectId
    );
    out.fixedVersionId = r.id;
    if (r.label) resolved.fixedVersion = r.label;
  }
  if (input.categoryId !== undefined) {
    requireProjectForName("categoryId", input.categoryId, input.projectId);
    const r = await resolveNamedRef(
      client,
      "categories",
      input.categoryId,
      "categoryId",
      input.projectId
    );
    out.categoryId = r.id;
    if (r.label) resolved.category = r.label;
  }
  for (const field of ["assignedTo", "authorId", "watcherId"] as const) {
    const value = input[field];
    if (value === undefined) continue;
    const r = await resolveUserFilter(client, input.projectId, value, field);
    out[field] = r.id;
    if (r.label) resolved[field] = r.label;
  }

  const result = await client.searchIssues(out);
  return Object.keys(resolved).length > 0 ? { resolved, ...result } : result;
}

export async function handleGetIssue(
  client: RedmineClient,
  input: GetIssueInput
) {
  return client.getIssue(input.issueId, { include: input.include });
}
