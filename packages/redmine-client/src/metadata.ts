import { RedmineError } from "./errors.js";
import type { RedmineHttp } from "./http.js";
import type {
  IssueCategoryOption,
  IssueCustomFieldOption,
  ListIssueCustomFieldsResult,
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

function named(f: RawNamed): IssueCustomFieldOption {
  return { id: f.id, name: f.name };
}

function isAuthOrPermissionError(err: unknown): boolean {
  return (
    err instanceof RedmineError &&
    (err.code === "REDMINE_PERMISSION_DENIED" ||
      err.code === "REDMINE_AUTHENTICATION_ERROR")
  );
}

type RawCustomFieldDef = RawNamed & {
  customized_type?: string;
  is_for_all?: boolean;
  projects?: RawNamed[];
};

/**
 * 프로젝트에서 쓸 수 있는 일감 사용자 정의 필드 (id + 이름).
 *
 * 1. GET /projects/:id.json?include=issue_custom_fields — Redmine 4.2+.
 *    키가 오면 그것이 답이다 (빈 배열이면 정말 없는 것).
 * 2. GET /custom_fields.json — 관리자 키에서만. 401/403이면 건너뛴다.
 * 3. 프로젝트 최근 이슈 100건의 custom_fields를 합친다. 어떤 버전·권한에서도
 *    되지만, 값이 한 번도 안 붙은 필드는 빠질 수 있다 (source: "issues").
 */
export async function listProjectIssueCustomFields(
  http: RedmineHttp,
  projectId: number
): Promise<ListIssueCustomFieldsResult> {
  const project = await http.getJson<{
    project?: { issue_custom_fields?: RawNamed[] };
  }>(`/projects/${projectId}.json`, { include: "issue_custom_fields" });
  const fromProject = project?.project?.issue_custom_fields;
  if (Array.isArray(fromProject)) {
    return { fields: fromProject.map(named), source: "project" };
  }

  try {
    const admin = await http.getJson<{ custom_fields?: RawCustomFieldDef[] }>(
      "/custom_fields.json"
    );
    const fields = (admin?.custom_fields ?? [])
      .filter((f) => f.customized_type === "issue")
      // projects가 없으면 판단할 수 없으니 넣어 둔다 (빠지는 것보다 낫다)
      .filter(
        (f) =>
          f.is_for_all ||
          !f.projects ||
          f.projects.some((p) => p.id === projectId)
      )
      .map(named);
    return { fields, source: "custom_fields" };
  } catch (err) {
    if (!isAuthOrPermissionError(err)) throw err;
  }

  const sample = await http.getJson<{
    issues?: Array<{ custom_fields?: RawNamed[] }>;
  }>("/issues.json", {
    project_id: projectId,
    status_id: "*",
    limit: 100,
    sort: "updated_on:desc",
  });
  const seen = new Map<number, IssueCustomFieldOption>();
  for (const issue of sample?.issues ?? []) {
    for (const f of issue.custom_fields ?? []) {
      if (!seen.has(f.id)) seen.set(f.id, named(f));
    }
  }
  return { fields: [...seen.values()], source: "issues" };
}
