import type { RedmineClient, RedmineUser } from "redmine-devrelay-client";
import { RedmineError, matchMemberByName } from "redmine-devrelay-client";
import type {
  AddCommentInput,
  CreateIssueInput,
  UpdateStatusInput,
} from "./schemas.js";

function compact(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

async function loadMembers(
  client: RedmineClient,
  projectId: number
): Promise<RedmineUser[]> {
  const { members } = await client.listProjectMembers({
    projectId,
    limit: 500,
  });
  return members;
}

async function resolveOneUser(
  client: RedmineClient,
  projectId: number,
  value: "me" | number | string,
  field: string,
  membersCache?: RedmineUser[]
): Promise<{ id: "me" | number; label: string; members: RedmineUser[] }> {
  if (value === "me") {
    return { id: "me", label: "me", members: membersCache ?? [] };
  }
  if (typeof value === "number") {
    return { id: value, label: String(value), members: membersCache ?? [] };
  }

  const query = value.trim();
  if (!query) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: `${field} name must be non-empty`,
      check: [`Pass a name, user id, or "me" for ${field}`],
    });
  }

  let members = membersCache;
  if (!members || members.length === 0) {
    members = await loadMembers(client, projectId);
  }

  let pool = matchMemberByName(members, query);

  // Fallback: global users API (may 403)
  if (pool.length === 0) {
    try {
      const { users } = await client.searchUsers({ query, limit: 50 });
      const q = compact(query);
      const exact = users.filter(
        (u) => compact(u.name) === q || compact(u.login) === q
      );
      pool = exact.length > 0 ? exact : users;
    } catch {
      /* keep empty */
    }
  }

  if (pool.length === 0) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: `No project member matched ${field}="${query}"`,
      check: [
        "Call redmine_list_project_members and pick an id",
        "Or pass a numeric user id",
      ],
    });
  }
  if (pool.length > 1) {
    const sample = pool
      .slice(0, 8)
      .map((u) => `${u.id}:${u.name}`)
      .join(", ");
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: `Ambiguous ${field}="${query}" — matches: ${sample}`,
      check: ["Pass the numeric user id from redmine_list_project_members"],
    });
  }

  const user = pool[0];
  return {
    id: user.id,
    label: user.name,
    members,
  };
}

/** Resolve assignedTo: "me" | userId | name → "me" | userId */
export async function resolveAssignedTo(
  client: RedmineClient,
  projectId: number,
  assignedTo: CreateIssueInput["assignedTo"],
  membersCache?: RedmineUser[]
): Promise<{ assignedTo: "me" | number; label?: string; members: RedmineUser[] } | undefined> {
  if (assignedTo === undefined) {
    return undefined;
  }
  const resolved = await resolveOneUser(
    client,
    projectId,
    assignedTo,
    "assignedTo",
    membersCache
  );
  return {
    assignedTo: resolved.id,
    label: resolved.label,
    members: resolved.members,
  };
}

/** Resolve 일감관리자 (watchers) entries to user ids */
export async function resolveWatchers(
  client: RedmineClient,
  projectId: number,
  watchers: CreateIssueInput["watchers"],
  membersCache?: RedmineUser[]
): Promise<
  | { watcherUserIds: number[]; watcherLabels: string[]; members: RedmineUser[] }
  | undefined
> {
  if (!watchers || watchers.length === 0) return undefined;

  let members = membersCache;
  const ids: number[] = [];
  const labels: string[] = [];

  for (const entry of watchers) {
    const resolved = await resolveOneUser(
      client,
      projectId,
      entry,
      "watchers",
      members
    );
    members = resolved.members;
    if (resolved.id === "me") {
      const me = await client.getCurrentUser();
      ids.push(me.id);
      labels.push(`${me.name} (me)`);
    } else {
      ids.push(resolved.id);
      labels.push(resolved.label);
    }
  }

  const uniqueIds = [...new Set(ids)];
  return {
    watcherUserIds: uniqueIds,
    watcherLabels: labels,
    members: members ?? [],
  };
}

export async function handleCreateIssue(
  client: RedmineClient,
  input: CreateIssueInput
) {
  const assignee = await resolveAssignedTo(
    client,
    input.projectId,
    input.assignedTo
  );
  const watchers = await resolveWatchers(
    client,
    input.projectId,
    input.watchers,
    assignee?.members
  );

  const wouldApply = {
    projectId: input.projectId,
    subject: input.subject,
    ...(input.description !== undefined
      ? { description: input.description }
      : {}),
    ...(input.trackerId !== undefined ? { trackerId: input.trackerId } : {}),
    ...(input.priorityId !== undefined ? { priorityId: input.priorityId } : {}),
    ...(assignee
      ? {
          assignedTo: assignee.assignedTo,
          ...(assignee.label ? { assignedToLabel: assignee.label } : {}),
        }
      : {}),
    ...(watchers
      ? {
          watcherUserIds: watchers.watcherUserIds,
          watcherLabels: watchers.watcherLabels,
        }
      : {}),
  };
  if (!input.confirm) {
    return { dryRun: true as const, wouldApply };
  }

  const createInput = {
    projectId: wouldApply.projectId,
    subject: wouldApply.subject,
    ...(wouldApply.description !== undefined
      ? { description: wouldApply.description }
      : {}),
    ...(wouldApply.trackerId !== undefined
      ? { trackerId: wouldApply.trackerId }
      : {}),
    ...(wouldApply.priorityId !== undefined
      ? { priorityId: wouldApply.priorityId }
      : {}),
    ...(wouldApply.assignedTo !== undefined
      ? { assignedTo: wouldApply.assignedTo }
      : {}),
    ...(wouldApply.watcherUserIds !== undefined
      ? { watcherUserIds: wouldApply.watcherUserIds }
      : {}),
  };
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
