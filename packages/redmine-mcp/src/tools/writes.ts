import type { RedmineClient } from "redmine-devrelay-client";
import { RedmineError } from "redmine-devrelay-client";
import type {
  AddCommentInput,
  CreateIssueInput,
  UpdateStatusInput,
} from "./schemas.js";

function compact(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

/** Resolve assignedTo: "me" | userId | name/login → "me" | userId */
export async function resolveAssignedTo(
  client: RedmineClient,
  assignedTo: CreateIssueInput["assignedTo"]
): Promise<{ assignedTo: "me" | number; label?: string } | undefined> {
  if (assignedTo === undefined) return undefined;
  if (assignedTo === "me") return { assignedTo: "me", label: "me" };
  if (typeof assignedTo === "number") {
    return { assignedTo, label: String(assignedTo) };
  }

  const query = assignedTo.trim();
  if (!query) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: "assignedTo name must be non-empty",
      check: ['Use "me", a user id, or a user name/login'],
    });
  }

  const { users } = await client.searchUsers({ query, limit: 50 });
  const q = compact(query);
  const exact = users.filter(
    (u) => compact(u.name) === q || compact(u.login) === q
  );
  const pool = exact.length > 0 ? exact : users;

  if (pool.length === 0) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: `No Redmine user matched assignedTo="${query}"`,
      check: [
        "Try redmine_search_users with the name",
        'Or pass assignedTo: "me" / numeric user id',
      ],
    });
  }
  if (pool.length > 1) {
    const sample = pool
      .slice(0, 8)
      .map((u) => `${u.id}:${u.name}(${u.login})`)
      .join(", ");
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: `Ambiguous assignedTo="${query}" — matches: ${sample}`,
      check: ["Pass the numeric user id from redmine_search_users"],
    });
  }

  const user = pool[0];
  return { assignedTo: user.id, label: `${user.name} (${user.login})` };
}

export async function handleCreateIssue(
  client: RedmineClient,
  input: CreateIssueInput
) {
  const resolved = await resolveAssignedTo(client, input.assignedTo);
  const wouldApply = {
    projectId: input.projectId,
    subject: input.subject,
    ...(input.description !== undefined
      ? { description: input.description }
      : {}),
    ...(input.trackerId !== undefined ? { trackerId: input.trackerId } : {}),
    ...(input.priorityId !== undefined ? { priorityId: input.priorityId } : {}),
    ...(resolved
      ? {
          assignedTo: resolved.assignedTo,
          ...(resolved.label ? { assignedToLabel: resolved.label } : {}),
        }
      : {}),
  };
  if (!input.confirm) {
    return { dryRun: true as const, wouldApply };
  }
  const { assignedToLabel: _label, ...createInput } = wouldApply as typeof wouldApply & {
    assignedToLabel?: string;
  };
  void _label;
  const result = await client.createIssue(createInput);
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
