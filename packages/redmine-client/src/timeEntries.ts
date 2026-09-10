import type { RedmineConfig } from "./config.js";
import { RedmineError } from "./errors.js";
import type { RedmineHttp } from "./http.js";
import type {
  CreateTimeEntryInput,
  CreateTimeEntryResult,
  ListTimeEntriesInput,
  ListTimeEntriesResult,
  TimeEntry,
  TimeEntryActivityOption,
} from "./types.js";

type RawNamed = { id: number; name: string };

type RawTimeEntry = {
  id: number;
  project?: RawNamed | null;
  issue?: { id: number } | null;
  user?: RawNamed | null;
  activity?: RawNamed | null;
  hours?: number | string | null;
  comments?: string | null;
  spent_on?: string | null;
  created_on?: string | null;
  updated_on?: string | null;
};

type RawTimeEntriesResponse = {
  time_entries: RawTimeEntry[];
  total_count: number;
  offset?: number;
  limit?: number;
};

function toHours(value: number | string | null | undefined): number {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  return Number.isFinite(n) ? n : 0;
}

export function normalizeTimeEntry(raw: RawTimeEntry): TimeEntry {
  return {
    id: raw.id,
    project: raw.project ?? null,
    issue: raw.issue ?? null,
    user: raw.user ?? null,
    activity: raw.activity ?? null,
    hours: toHours(raw.hours),
    comments: raw.comments ?? "",
    spentOn: raw.spent_on ?? "",
    createdOn: raw.created_on ?? null,
    updatedOn: raw.updated_on ?? null,
  };
}

/**
 * Redmine의 spent_on 필터 문법: 둘 다 있으면 `><from|to`, 하나면 `>=from` / `<=to`.
 */
export function buildTimeEntryQuery(
  input: ListTimeEntriesInput
): Record<string, string | number> {
  const query: Record<string, string | number> = {};
  if (input.issueId !== undefined) query.issue_id = input.issueId;
  if (input.projectId !== undefined) query.project_id = input.projectId;
  if (input.userId !== undefined) query.user_id = String(input.userId);
  if (input.activityId !== undefined) query.activity_id = input.activityId;
  if (input.spentFrom && input.spentTo) {
    query.spent_on = `><${input.spentFrom}|${input.spentTo}`;
  } else if (input.spentFrom) {
    query.spent_on = `>=${input.spentFrom}`;
  } else if (input.spentTo) {
    query.spent_on = `<=${input.spentTo}`;
  }
  query.sort = "spent_on:desc";
  return query;
}

/** 작업시간 목록 (GET /time_entries.json) — 최근 날짜부터, 페이지를 이어 받는다 */
export async function listTimeEntries(
  http: RedmineHttp,
  config: RedmineConfig,
  input: ListTimeEntriesInput = {}
): Promise<ListTimeEntriesResult> {
  const wanted = Math.min(
    input.limit ?? config.maxResultCount,
    config.maxResultCount
  );
  const baseQuery = buildTimeEntryQuery(input);
  const startOffset = input.offset ?? 0;
  const collected: TimeEntry[] = [];
  let offset = startOffset;
  let totalCount = 0;

  while (collected.length < wanted) {
    const pageLimit = Math.min(100, wanted - collected.length);
    const page = await http.getJson<RawTimeEntriesResponse>(
      "/time_entries.json",
      { ...baseQuery, limit: pageLimit, offset }
    );
    totalCount = page.total_count;
    const rows = page.time_entries ?? [];
    collected.push(...rows.map(normalizeTimeEntry));
    offset += rows.length;
    if (rows.length === 0 || offset >= totalCount) break;
  }

  const totalHours = collected.reduce((sum, e) => sum + e.hours, 0);
  return {
    entries: collected,
    totalCount,
    returnedCount: collected.length,
    hasMore: startOffset + collected.length < totalCount,
    // 부동소수 합계를 사람이 읽을 수 있게 소수 둘째 자리까지
    totalHours: Math.round(totalHours * 100) / 100,
  };
}

/** 작업시간 기록 (POST /time_entries.json) */
export async function createTimeEntry(
  http: RedmineHttp,
  input: CreateTimeEntryInput
): Promise<CreateTimeEntryResult> {
  if (input.issueId === undefined && input.projectId === undefined) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: "A time entry needs issueId or projectId",
      check: ["Pass the issue id (preferred) or a project id"],
    });
  }
  if (!(input.hours > 0)) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: `hours must be positive (got ${input.hours})`,
      check: ["Pass hours as a positive number, e.g. 1.5"],
    });
  }

  const timeEntry: Record<string, unknown> = { hours: input.hours };
  if (input.issueId !== undefined) timeEntry.issue_id = input.issueId;
  else timeEntry.project_id = input.projectId;
  if (input.spentOn !== undefined) timeEntry.spent_on = input.spentOn;
  if (input.activityId !== undefined) timeEntry.activity_id = input.activityId;
  if (input.comments !== undefined) timeEntry.comments = input.comments;

  const data = await http.postJson<{ time_entry?: RawTimeEntry }>(
    "/time_entries.json",
    { time_entry: timeEntry }
  );
  if (!data?.time_entry) {
    throw new Error("Redmine createTimeEntry returned empty body");
  }
  const entry = normalizeTimeEntry(data.time_entry);
  return {
    id: entry.id,
    hours: entry.hours,
    spentOn: entry.spentOn,
    issueId: entry.issue?.id ?? input.issueId ?? null,
    projectId: entry.project?.id ?? input.projectId ?? null,
    activity: entry.activity,
    comments: entry.comments,
  };
}

/** 작업 분류(활동) 목록 (GET /enumerations/time_entry_activities.json) */
export async function listTimeEntryActivities(
  http: RedmineHttp
): Promise<TimeEntryActivityOption[]> {
  const data = await http.getJson<{
    time_entry_activities?: Array<RawNamed & { is_default?: boolean }>;
  }>("/enumerations/time_entry_activities.json");
  return (data?.time_entry_activities ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    isDefault: Boolean(a.is_default),
  }));
}
