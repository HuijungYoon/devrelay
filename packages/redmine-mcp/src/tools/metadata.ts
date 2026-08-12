import type { RedmineClient, RedmineNamed } from "redmine-devrelay-client";
import { RedmineError, matchNamedByName } from "redmine-devrelay-client";
import type { ListMetadataInput } from "./schemas.js";

export type MetadataKind =
  | "trackers"
  | "statuses"
  | "priorities"
  | "versions"
  | "categories";

const PROJECT_KINDS: MetadataKind[] = ["versions", "categories"];

const KIND_LABEL: Record<MetadataKind, string> = {
  trackers: "유형",
  statuses: "상태",
  priorities: "우선순위",
  versions: "대상 버전",
  categories: "범주",
};

function requireProjectId(
  kind: MetadataKind,
  projectId: number | undefined
): number {
  if (projectId === undefined) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: `${kind} requires projectId (${KIND_LABEL[kind]} is per project)`,
      check: ["Pass projectId", "Or resolve it with redmine_list_projects"],
    });
  }
  return projectId;
}

async function loadOptions(
  client: RedmineClient,
  kind: MetadataKind,
  projectId?: number
): Promise<RedmineNamed[]> {
  switch (kind) {
    case "trackers":
      return client.listTrackers();
    case "statuses":
      return client.listIssueStatuses();
    case "priorities":
      return client.listIssuePriorities();
    case "versions":
      return client.listProjectVersions(requireProjectId(kind, projectId));
    case "categories":
      return client.listIssueCategories(requireProjectId(kind, projectId));
  }
}

function sample(items: RedmineNamed[]): string {
  return items
    .slice(0, 12)
    .map((i) => `${i.id}:${i.name}`)
    .join(", ");
}

function compact(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

function isPermissionDenied(err: unknown): boolean {
  return (
    err instanceof RedmineError && err.code === "REDMINE_PERMISSION_DENIED"
  );
}

/**
 * 이름 목록을 못 읽는 프로젝트도 있습니다 (범주는 권한을 따로 막아 두는 경우가 많음).
 * 그때는 이름 해석을 포기하고 id를 넣으라고 안내합니다.
 */
async function loadOptionsForMatch(
  client: RedmineClient,
  kind: MetadataKind,
  field: string,
  projectId?: number
): Promise<RedmineNamed[]> {
  try {
    return await loadOptions(client, kind, projectId);
  } catch (err) {
    if (!isPermissionDenied(err)) throw err;
    throw new RedmineError({
      code: "REDMINE_PERMISSION_DENIED",
      message: `Cannot read the ${KIND_LABEL[kind]} list, so ${field}="..." cannot be resolved by name`,
      httpStatus: 403,
      retrySafe: false,
      check: [
        `Pass a numeric id for ${field} instead of a name`,
        `Look the id up in Redmine (the ${KIND_LABEL[kind]} dropdown on the issue form)`,
      ],
    });
  }
}

/**
 * id 또는 이름을 id로 해석합니다. 숫자(또는 숫자 문자열)는 그대로 통과시키고,
 * 이름은 목록을 받아 매칭합니다 (못 찾으면 후보를 담은 에러).
 */
export async function resolveNamedRef(
  client: RedmineClient,
  kind: MetadataKind,
  value: number | string,
  field: string,
  projectId?: number
): Promise<{ id: number; label?: string }> {
  if (typeof value === "number") return { id: value };

  const query = value.trim();
  if (!query) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: `${field} must be a non-empty name or id`,
      check: [`Pass an id, or a ${KIND_LABEL[kind]} name`],
    });
  }
  if (/^\d+$/.test(query)) return { id: Number(query) };

  const options = await loadOptionsForMatch(client, kind, field, projectId);
  let matches = matchNamedByName(options, query);

  // "진행중으로" 처럼 사용자가 붙여 말한 경우: 이름이 질문에 포함되면 받아 준다.
  // 유일할 때만 — 여러 개면 아래 ambiguous 에러로 떨어진다.
  if (matches.length === 0) {
    const q = compact(query);
    matches = options.filter((o) => {
      const name = compact(o.name);
      return name.length >= 2 && q.includes(name);
    });
  }

  if (matches.length === 0) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: `No ${KIND_LABEL[kind]} matched ${field}="${query}"`,
      check: [
        `Available: ${sample(options) || "(none)"}`,
        "Call redmine_list_metadata to see the full list",
      ],
    });
  }
  if (matches.length > 1) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: `Ambiguous ${field}="${query}" — matches: ${sample(matches)}`,
      check: ["Pass the exact name or the numeric id"],
    });
  }

  return { id: matches[0].id, label: matches[0].name };
}

export type IssueMetaInput = {
  trackerId?: number | string;
  statusId?: number | string;
  priorityId?: number | string;
  fixedVersionId?: number | string | null;
  categoryId?: number | string | null;
};

export type ResolvedIssueMeta = {
  trackerId?: number;
  trackerLabel?: string;
  statusId?: number;
  statusLabel?: string;
  priorityId?: number;
  priorityLabel?: string;
  fixedVersionId?: number | null;
  fixedVersionLabel?: string;
  categoryId?: number | null;
  categoryLabel?: string;
};

/** create/update의 유형·상태·우선순위·대상 버전·범주를 한 번에 해석 */
export async function resolveIssueMetadata(
  client: RedmineClient,
  projectId: number | undefined,
  input: IssueMetaInput
): Promise<ResolvedIssueMeta> {
  const out: ResolvedIssueMeta = {};

  if (input.trackerId !== undefined) {
    const r = await resolveNamedRef(
      client,
      "trackers",
      input.trackerId,
      "trackerId"
    );
    out.trackerId = r.id;
    if (r.label) out.trackerLabel = r.label;
  }
  if (input.statusId !== undefined) {
    const r = await resolveNamedRef(
      client,
      "statuses",
      input.statusId,
      "statusId"
    );
    out.statusId = r.id;
    if (r.label) out.statusLabel = r.label;
  }
  if (input.priorityId !== undefined) {
    const r = await resolveNamedRef(
      client,
      "priorities",
      input.priorityId,
      "priorityId"
    );
    out.priorityId = r.id;
    if (r.label) out.priorityLabel = r.label;
  }
  if (input.fixedVersionId !== undefined) {
    if (input.fixedVersionId === null) {
      out.fixedVersionId = null;
    } else {
      const r = await resolveNamedRef(
        client,
        "versions",
        input.fixedVersionId,
        "fixedVersionId",
        projectId
      );
      out.fixedVersionId = r.id;
      if (r.label) out.fixedVersionLabel = r.label;
    }
  }
  if (input.categoryId !== undefined) {
    if (input.categoryId === null) {
      out.categoryId = null;
    } else {
      const r = await resolveNamedRef(
        client,
        "categories",
        input.categoryId,
        "categoryId",
        projectId
      );
      out.categoryId = r.id;
      if (r.label) out.categoryLabel = r.label;
    }
  }

  return out;
}

/** 읽기 도구: 유형·상태·우선순위(+프로젝트별 버전·범주) 목록 */
export async function handleListMetadata(
  client: RedmineClient,
  input: ListMetadataInput
) {
  const kinds: MetadataKind[] =
    input.kinds && input.kinds.length > 0
      ? [...input.kinds]
      : input.projectId === undefined
        ? ["trackers", "statuses", "priorities"]
        : ["trackers", "statuses", "priorities", "versions", "categories"];

  const result: Record<string, unknown> = {};
  if (input.projectId !== undefined) result.projectId = input.projectId;
  const unavailable: Array<{ kind: MetadataKind; reason: string }> = [];

  for (const kind of kinds) {
    if (PROJECT_KINDS.includes(kind)) requireProjectId(kind, input.projectId);
    try {
      result[kind] = await loadOptions(client, kind, input.projectId);
    } catch (err) {
      // 한 종류가 권한으로 막혀도 나머지는 돌려준다 (범주가 흔한 경우).
      if (!isPermissionDenied(err)) throw err;
      unavailable.push({ kind, reason: "REDMINE_PERMISSION_DENIED" });
    }
  }

  if (unavailable.length > 0) result.unavailable = unavailable;
  return result;
}
