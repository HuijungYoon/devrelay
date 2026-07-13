import type { RedmineClient } from "redmine-devrelay-client";
import type {
  AddCommentInput,
  CreateIssueInput,
  UpdateStatusInput,
} from "./schemas.js";

export async function handleCreateIssue(
  client: RedmineClient,
  input: CreateIssueInput
) {
  const wouldApply = {
    projectId: input.projectId,
    subject: input.subject,
    ...(input.description !== undefined
      ? { description: input.description }
      : {}),
    ...(input.trackerId !== undefined ? { trackerId: input.trackerId } : {}),
    ...(input.priorityId !== undefined ? { priorityId: input.priorityId } : {}),
    ...(input.assignedTo !== undefined ? { assignedTo: input.assignedTo } : {}),
  };
  if (!input.confirm) {
    return { dryRun: true as const, wouldApply };
  }
  const result = await client.createIssue(wouldApply);
  return { dryRun: false as const, result };
}

export async function handleAddComment(
  client: RedmineClient,
  input: AddCommentInput
) {
  const wouldApply = { issueId: input.issueId, notes: input.notes };
  if (!input.confirm) {
    return { dryRun: true as const, wouldApply };
  }
  const result = await client.addComment(input.issueId, input.notes);
  return { dryRun: false as const, result };
}

export async function handleUpdateStatus(
  client: RedmineClient,
  input: UpdateStatusInput
) {
  const wouldApply = {
    issueId: input.issueId,
    statusId: input.statusId,
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  };
  if (!input.confirm) {
    return { dryRun: true as const, wouldApply };
  }
  const result = await client.updateIssueStatus(
    input.issueId,
    input.statusId,
    input.notes
  );
  return { dryRun: false as const, result };
}
