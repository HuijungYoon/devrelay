import type { RedmineHttp } from "./http.js";
import type {
  IssueCategoryOption,
  IssuePriorityOption,
  IssueStatusOption,
  ProjectVersionOption,
  RedmineNamed,
} from "./types.js";

type RawNamed = { id: number; name: string };

function compact(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

/**
 * Match `name` against a list of id/name options: exact (case- and
 * space-insensitive) first, then substring. Same rules as matchMemberByName.
 */
export function matchNamedByName<T extends RedmineNamed>(
  items: T[],
  name: string
): T[] {
  const q = compact(name);
  const exact = items.filter((i) => compact(i.name) === q);
  if (exact.length > 0) return exact;
  return items.filter((i) => compact(i.name).includes(q));
}

/** 유형 (GET /trackers.json) */
export async function listTrackers(
  http: RedmineHttp
): Promise<RedmineNamed[]> {
  const data = await http.getJson<{ trackers?: RawNamed[] }>(
    "/trackers.json"
  );
  return (data?.trackers ?? []).map((t) => ({ id: t.id, name: t.name }));
}

/** 상태 (GET /issue_statuses.json) */
export async function listIssueStatuses(
  http: RedmineHttp
): Promise<IssueStatusOption[]> {
  const data = await http.getJson<{
    issue_statuses?: Array<RawNamed & { is_closed?: boolean }>;
  }>("/issue_statuses.json");
  return (data?.issue_statuses ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    isClosed: Boolean(s.is_closed),
  }));
}

/** 우선순위 (GET /enumerations/issue_priorities.json) */
export async function listIssuePriorities(
  http: RedmineHttp
): Promise<IssuePriorityOption[]> {
  const data = await http.getJson<{
    issue_priorities?: Array<RawNamed & { is_default?: boolean }>;
  }>("/enumerations/issue_priorities.json");
  return (data?.issue_priorities ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    isDefault: Boolean(p.is_default),
  }));
}

/** 대상 버전 (GET /projects/:id/versions.json) */
export async function listProjectVersions(
  http: RedmineHttp,
  projectId: number
): Promise<ProjectVersionOption[]> {
  const data = await http.getJson<{
    versions?: Array<
      RawNamed & { status?: string; due_date?: string | null }
    >;
  }>(`/projects/${projectId}/versions.json`);
  return (data?.versions ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    status: v.status ?? "open",
    dueDate: v.due_date ?? null,
  }));
}

/** 범주 (GET /projects/:id/issue_categories.json) */
export async function listIssueCategories(
  http: RedmineHttp,
  projectId: number
): Promise<IssueCategoryOption[]> {
  const data = await http.getJson<{
    issue_categories?: Array<RawNamed & { assigned_to?: RawNamed | null }>;
  }>(`/projects/${projectId}/issue_categories.json`);
  return (data?.issue_categories ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    assignedTo: c.assigned_to ?? null,
  }));
}
