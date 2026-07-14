import type { RedmineHttp } from "./http.js";
import type {
  AddCommentResult,
  AddIssueAttachmentsInput,
  AddIssueAttachmentsResult,
  CreateIssueInput,
  CreateIssueResult,
  UpdateIssueInput,
  UpdateIssueResult,
  UpdateStatusResult,
} from "./types.js";
import { formatDescriptionForRedmine, formatNotesForRedmine } from "./textile.js";

type RawIssue = {
  issue: {
    id: number;
    subject?: string;
    project?: { id: number; name: string } | null;
    status?: { id: number; name: string } | null;
  };
};

function applyOptionalIssueFields(
  issue: Record<string, unknown>,
  input: {
    description?: string;
    trackerId?: number;
    statusId?: number;
    priorityId?: number;
    startDate?: string;
    dueDate?: string;
    doneRatio?: number;
    estimatedHours?: number;
    assignedTo?: "me" | number;
    watcherUserIds?: number[];
    notes?: string;
  },
  opts: { includeWatchersEmpty?: boolean } = {}
): void {
  if (input.description !== undefined) {
    issue.description = formatDescriptionForRedmine(input.description);
  }
  if (input.trackerId !== undefined) issue.tracker_id = input.trackerId;
  if (input.statusId !== undefined) issue.status_id = input.statusId;
  if (input.priorityId !== undefined) issue.priority_id = input.priorityId;
  if (input.startDate !== undefined) issue.start_date = input.startDate;
  if (input.dueDate !== undefined) issue.due_date = input.dueDate;
  if (input.doneRatio !== undefined) issue.done_ratio = input.doneRatio;
  if (input.estimatedHours !== undefined) {
    issue.estimated_hours = input.estimatedHours;
  }
  if (input.assignedTo !== undefined) issue.assigned_to_id = input.assignedTo;
  if (input.watcherUserIds !== undefined) {
    if (input.watcherUserIds.length > 0 || opts.includeWatchersEmpty) {
      issue.watcher_user_ids = input.watcherUserIds;
    }
  }
  if (input.notes !== undefined) issue.notes = formatNotesForRedmine(input.notes);
}

export async function createIssue(
  http: RedmineHttp,
  input: CreateIssueInput
): Promise<CreateIssueResult> {
  const issue: Record<string, unknown> = {
    project_id: input.projectId,
    subject: input.subject,
  };
  applyOptionalIssueFields(issue, input, { includeWatchersEmpty: false });
  if (input.uploads?.length) {
    issue.uploads = input.uploads.map((u) => ({
      token: u.token,
      filename: u.filename,
      ...(u.description !== undefined ? { description: u.description } : {}),
    }));
  }

  const data = await http.postJson<RawIssue>("/issues.json", { issue });
  if (!data?.issue) {
    throw new Error("Redmine createIssue returned empty body");
  }
  return {
    id: data.issue.id,
    subject: data.issue.subject ?? input.subject,
    project: data.issue.project ?? null,
    status: data.issue.status ?? null,
  };
}

export async function updateIssue(
  http: RedmineHttp,
  input: UpdateIssueInput
): Promise<UpdateIssueResult> {
  const issue: Record<string, unknown> = {};
  if (input.subject !== undefined) issue.subject = input.subject;
  applyOptionalIssueFields(issue, input, { includeWatchersEmpty: true });

  const data = await http.putJson<RawIssue>(`/issues/${input.issueId}.json`, {
    issue,
  });
  return {
    issueId: input.issueId,
    subject: data?.issue?.subject ?? input.subject,
    status: data?.issue?.status ?? null,
  };
}

export async function addIssueAttachments(
  http: RedmineHttp,
  input: AddIssueAttachmentsInput
): Promise<AddIssueAttachmentsResult> {
  await http.putJson(`/issues/${input.issueId}.json`, {
    issue: {
      uploads: input.uploads.map((u) => ({
        token: u.token,
        filename: u.filename,
        ...(u.description !== undefined ? { description: u.description } : {}),
      })),
    },
  });
  return { issueId: input.issueId, uploadedCount: input.uploads.length };
}

export async function addComment(
  http: RedmineHttp,
  issueId: number,
  notes: string
): Promise<AddCommentResult> {
  await http.putJson(`/issues/${issueId}.json`, {
    issue: { notes: formatNotesForRedmine(notes) },
  });
  return { issueId, updated: true };
}

export async function updateIssueStatus(
  http: RedmineHttp,
  issueId: number,
  statusId: number,
  notes?: string
): Promise<UpdateStatusResult> {
  const issue: Record<string, unknown> = { status_id: statusId };
  if (notes !== undefined) issue.notes = formatNotesForRedmine(notes);
  const data = await http.putJson<RawIssue>(`/issues/${issueId}.json`, {
    issue,
  });
  return {
    issueId,
    status: data?.issue?.status ?? { id: statusId, name: String(statusId) },
  };
}
