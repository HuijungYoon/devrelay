import type { RedmineConfig } from "./config.js";
import { RedmineError } from "./errors.js";
import type { RedmineHttp } from "./http.js";
import type {
  IssueInclude,
  NormalizedIssueDetail,
  NormalizedIssueSummary,
  SearchIssuesInput,
  SearchIssuesResult,
} from "./types.js";

type RawNamed = { id: number; name: string };

type RawIssue = {
  id: number;
  subject: string;
  description?: string;
  project?: RawNamed | null;
  tracker?: RawNamed | null;
  status?: RawNamed | null;
  priority?: RawNamed | null;
  author?: RawNamed | null;
  assigned_to?: RawNamed | null;
  start_date?: string | null;
  due_date?: string | null;
  done_ratio?: number | null;
  estimated_hours?: number | null;
  parent?: { id: number } | null;
  custom_fields?: Array<{ id: number; name: string; value: unknown }>;
  journals?: Array<{
    id: number;
    user?: RawNamed | null;
    notes?: string;
    created_on: string;
    private_notes?: boolean;
  }>;
  attachments?: Array<{
    id: number;
    filename: string;
    filesize: number;
    content_type: string;
    created_on: string;
  }>;
  relations?: unknown[];
  children?: unknown[];
  allowed_statuses?: RawNamed[];
  updated_on?: string | null;
  created_on?: string | null;
};

type RawIssuesResponse = {
  issues: RawIssue[];
  total_count: number;
  offset: number;
  limit: number;
};

export function buildIssueQuery(
  input: SearchIssuesInput
): Record<string, string | number> {
  const query: Record<string, string | number> = {};

  if (input.projectId !== undefined) query.project_id = input.projectId;
  if (input.issueId !== undefined) query.issue_id = input.issueId;
  if (input.assignedTo !== undefined) {
    query.assigned_to_id = String(input.assignedTo);
  }

  if (input.status === undefined || input.status === "open") {
    query.status_id = "open";
  } else if (input.status === "closed") {
    query.status_id = "closed";
  } else if (input.status === "all") {
    query.status_id = "*";
  } else {
    query.status_id = input.status;
  }

  if (input.trackerId !== undefined) query.tracker_id = input.trackerId;
  if (input.priorityId !== undefined) query.priority_id = input.priorityId;
  if (input.subjectContains) query.subject = `~${input.subjectContains}`;
  if (input.parentIssueId !== undefined) {
    query.parent_id = input.parentIssueId;
  }
  if (input.createdAfter) query.created_on = `>=${input.createdAfter}`;
  if (input.updatedAfter) query.updated_on = `>=${input.updatedAfter}`;

  if (input.customFields) {
    for (const field of input.customFields) {
      query[`cf_${field.id}`] = field.value;
    }
  }

  if (input.sort?.length) {
    query.sort = input.sort
      .map((s) => `${s.field}:${s.direction}`)
      .join(",");
  }

  return query;
}

function normalizeSummary(raw: RawIssue): NormalizedIssueSummary {
  return {
    id: raw.id,
    subject: raw.subject,
    project: raw.project ?? null,
    tracker: raw.tracker ?? null,
    status: raw.status ?? null,
    priority: raw.priority ?? null,
    assignedTo: raw.assigned_to ?? null,
    updatedOn: raw.updated_on ?? null,
    createdOn: raw.created_on ?? null,
  };
}

function normalizeDetail(raw: RawIssue): NormalizedIssueDetail {
  return {
    ...normalizeSummary(raw),
    description: raw.description ?? "",
    author: raw.author ?? null,
    startDate: raw.start_date ?? null,
    dueDate: raw.due_date ?? null,
    doneRatio: raw.done_ratio ?? null,
    estimatedHours: raw.estimated_hours ?? null,
    parent: raw.parent ?? null,
    customFields: (raw.custom_fields ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      value: f.value,
    })),
    journals: raw.journals?.map((j) => ({
      id: j.id,
      user: j.user ?? null,
      notes: j.notes ?? "",
      createdOn: j.created_on,
      privateNotes: Boolean(j.private_notes),
    })),
    attachments: raw.attachments?.map((a) => ({
      id: a.id,
      filename: a.filename,
      filesize: a.filesize,
      contentType: a.content_type,
      createdOn: a.created_on,
    })),
    relations: raw.relations,
    children: raw.children,
    allowedStatuses: raw.allowed_statuses,
  };
}

export async function searchIssues(
  http: RedmineHttp,
  config: RedmineConfig,
  input: SearchIssuesInput = {}
): Promise<SearchIssuesResult> {
  const wanted = Math.min(
    input.limit ?? config.maxResultCount,
    config.maxResultCount
  );
  const baseQuery = buildIssueQuery(input);
  const startOffset = input.offset ?? 0;
  const collected: NormalizedIssueSummary[] = [];
  let offset = startOffset;
  let totalCount = 0;

  while (collected.length < wanted) {
    const pageLimit = Math.min(100, wanted - collected.length);
    const page = await http.getJson<RawIssuesResponse>("/issues.json", {
      ...baseQuery,
      limit: pageLimit,
      offset,
    });
    totalCount = page.total_count;
    collected.push(...page.issues.map(normalizeSummary));
    offset += page.issues.length;
    if (page.issues.length === 0 || offset >= totalCount) break;
  }

  const issues = collected.slice(0, wanted);
  return {
    issues,
    totalCount,
    returnedCount: issues.length,
    hasMore: startOffset + issues.length < totalCount,
  };
}

export async function getIssue(
  http: RedmineHttp,
  issueId: number,
  opts: { include?: IssueInclude[] } = {}
): Promise<NormalizedIssueDetail> {
  if (!Number.isInteger(issueId) || issueId <= 0) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: "issueId must be a positive integer",
    });
  }

  const query: Record<string, string | number | undefined> = {};
  if (opts.include?.length) {
    query.include = opts.include.join(",");
  }

  try {
    const data = await http.getJson<{ issue: RawIssue }>(
      `/issues/${issueId}.json`,
      query
    );
    return normalizeDetail(data.issue);
  } catch (err) {
    if (
      err instanceof RedmineError &&
      err.httpStatus === 404 &&
      err.code === "REDMINE_UNKNOWN_ERROR"
    ) {
      throw new RedmineError({
        code: "REDMINE_ISSUE_NOT_FOUND",
        message: `Issue #${issueId} was not found`,
        httpStatus: 404,
        check: ["Confirm the issue id", "Confirm project access"],
        retrySafe: false,
      });
    }
    throw err;
  }
}
