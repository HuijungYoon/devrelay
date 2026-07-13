import type { RedmineHttp } from "./http.js";
import type {
  AddCommentResult,
  CreateIssueInput,
  CreateIssueResult,
  UpdateStatusResult,
} from "./types.js";

type RawIssue = {
  issue: {
    id: number;
    subject?: string;
    project?: { id: number; name: string } | null;
    status?: { id: number; name: string } | null;
  };
};

export async function createIssue(
  http: RedmineHttp,
  input: CreateIssueInput
): Promise<CreateIssueResult> {
  const issue: Record<string, unknown> = {
    project_id: input.projectId,
    subject: input.subject,
  };
  if (input.description !== undefined) issue.description = input.description;
  if (input.trackerId !== undefined) issue.tracker_id = input.trackerId;
  if (input.priorityId !== undefined) issue.priority_id = input.priorityId;
  if (input.assignedTo !== undefined) issue.assigned_to_id = input.assignedTo;
  if (input.watcherUserIds !== undefined && input.watcherUserIds.length > 0) {
    issue.watcher_user_ids = input.watcherUserIds;
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

export async function addComment(
  http: RedmineHttp,
  issueId: number,
  notes: string
): Promise<AddCommentResult> {
  await http.putJson(`/issues/${issueId}.json`, { issue: { notes } });
  return { issueId, updated: true };
}

export async function updateIssueStatus(
  http: RedmineHttp,
  issueId: number,
  statusId: number,
  notes?: string
): Promise<UpdateStatusResult> {
  const issue: Record<string, unknown> = { status_id: statusId };
  if (notes !== undefined) issue.notes = notes;
  const data = await http.putJson<RawIssue>(`/issues/${issueId}.json`, {
    issue,
  });
  return {
    issueId,
    status: data?.issue?.status ?? { id: statusId, name: String(statusId) },
  };
}
