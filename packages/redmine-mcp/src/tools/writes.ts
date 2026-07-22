import type { RedmineClient, RedmineUser } from "redmine-devrelay-client";
import {
  RedmineError,
  detectNotesMarkup,
  formatDescriptionForRedmine,
  matchMemberByName,
} from "redmine-devrelay-client";
import type {
  AddAttachmentInput,
  AddCommentInput,
  CreateIssueInput,
  UpdateIssueInput,
  UpdateStatusInput,
} from "./schemas.js";
import {
  consumePreviewToken,
  issuePreviewToken,
  type PreviewTool,
} from "./previewStore.js";

type NotesMarkupBlock = {
  blocked: true;
  reason: string;
  matches: string[];
};

function asPayload(input: object): Record<string, unknown> {
  return input as Record<string, unknown>;
}

function withIssuedToken<T extends Record<string, unknown>>(
  tool: PreviewTool,
  input: object,
  preview: T
): T & { previewToken: string } {
  return {
    ...preview,
    previewToken: issuePreviewToken(tool, asPayload(input)),
  };
}

function consumeIfConfirm(
  tool: PreviewTool,
  input: { confirm?: boolean; previewToken?: string }
): void {
  if (input.confirm) {
    consumePreviewToken(tool, input.previewToken, asPayload(input));
  }
}

function notesMarkupBlock(notes: string): NotesMarkupBlock | null {
  const matches = detectNotesMarkup(notes);
  if (matches.length === 0) return null;
  return {
    blocked: true,
    reason: "notes must be plain text (no Textile/Markdown)",
    matches,
  };
}

function assertPlainNotesOrThrow(notes: string): void {
  const block = notesMarkupBlock(notes);
  if (!block) return;
  throw new RedmineError({
    code: "REDMINE_VALIDATION_ERROR",
    message: `${block.reason}: found ${block.matches.join(", ")}`,
    check: [
      "Rewrite notes as plain text (newlines only)",
      "Do not use Textile (h3., *, bq.) or Markdown (# , -, **bold**)",
      `Remove: ${block.matches.join(", ")}`,
    ],
  });
}

function attachmentWouldApply(
  client: RedmineClient,
  attachments: CreateIssueInput["attachments"]
) {
  if (!attachments?.length) return undefined;
  return client.inspectAttachments(attachments).map((a) => ({
    path: a.path,
    filename: a.filename,
    sizeBytes: a.sizeBytes,
    ...(a.description !== undefined ? { description: a.description } : {}),
  }));
}

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
      ? { description: formatDescriptionForRedmine(input.description) }
      : {}),
    ...(input.trackerId !== undefined ? { trackerId: input.trackerId } : {}),
    ...(input.statusId !== undefined ? { statusId: input.statusId } : {}),
    ...(input.priorityId !== undefined ? { priorityId: input.priorityId } : {}),
    ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
    ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
    ...(input.doneRatio !== undefined ? { doneRatio: input.doneRatio } : {}),
    ...(input.estimatedHours !== undefined
      ? { estimatedHours: input.estimatedHours }
      : {}),
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
    ...(input.attachments?.length
      ? { attachments: attachmentWouldApply(client, input.attachments) }
      : {}),
  };
  if (!input.confirm) {
    return withIssuedToken("redmine_create_issue", input, {
      dryRun: true as const,
      wouldApply,
    });
  }

  consumeIfConfirm("redmine_create_issue", input);

  const uploads = input.attachments?.length
    ? await client.uploadAttachments(input.attachments)
    : undefined;

  const createInput = {
    projectId: wouldApply.projectId,
    subject: wouldApply.subject,
    ...(wouldApply.description !== undefined
      ? { description: wouldApply.description }
      : {}),
    ...(wouldApply.trackerId !== undefined
      ? { trackerId: wouldApply.trackerId }
      : {}),
    ...(wouldApply.statusId !== undefined
      ? { statusId: wouldApply.statusId }
      : {}),
    ...(wouldApply.priorityId !== undefined
      ? { priorityId: wouldApply.priorityId }
      : {}),
    ...(wouldApply.startDate !== undefined
      ? { startDate: wouldApply.startDate }
      : {}),
    ...(wouldApply.dueDate !== undefined
      ? { dueDate: wouldApply.dueDate }
      : {}),
    ...(wouldApply.doneRatio !== undefined
      ? { doneRatio: wouldApply.doneRatio }
      : {}),
    ...(wouldApply.estimatedHours !== undefined
      ? { estimatedHours: wouldApply.estimatedHours }
      : {}),
    ...(wouldApply.assignedTo !== undefined
      ? { assignedTo: wouldApply.assignedTo }
      : {}),
    ...(wouldApply.watcherUserIds !== undefined
      ? { watcherUserIds: wouldApply.watcherUserIds }
      : {}),
    ...(uploads
      ? {
          uploads: uploads.map((u) => ({
            token: u.token,
            filename: u.filename,
            ...(u.description !== undefined
              ? { description: u.description }
              : {}),
          })),
        }
      : {}),
  };
  const result = await client.createIssue(createInput);
  return { dryRun: false as const, result };
}

export type FieldChange = {
  field: string;
  from: unknown;
  to: unknown;
};

export async function handleUpdateIssue(
  client: RedmineClient,
  input: UpdateIssueInput
) {
  if (input.notes !== undefined) {
    const block = notesMarkupBlock(input.notes);
    if (block) {
      if (input.confirm) assertPlainNotesOrThrow(input.notes);
      return { dryRun: true as const, issueId: input.issueId, ...block };
    }
  }

  const current = await client.getIssue(input.issueId);
  const projectId = current.project?.id;
  if (!projectId) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: `Issue #${input.issueId} has no project id`,
      check: ["Verify the issue exists and is accessible"],
    });
  }

  const assignee = await resolveAssignedTo(
    client,
    projectId,
    input.assignedTo
  );
  const watchers = await resolveWatchers(
    client,
    projectId,
    input.watchers,
    assignee?.members
  );

  const changes: FieldChange[] = [];
  const push = (field: string, from: unknown, to: unknown) => {
    if (from === to) return;
    changes.push({ field, from, to });
  };

  if (input.subject !== undefined) {
    push("subject", current.subject, input.subject);
  }
  if (input.description !== undefined) {
    push(
      "description",
      current.description,
      formatDescriptionForRedmine(input.description)
    );
  }
  if (input.trackerId !== undefined) {
    push("trackerId", current.tracker?.id ?? null, input.trackerId);
  }
  if (input.statusId !== undefined) {
    push("statusId", current.status?.id ?? null, input.statusId);
  }
  if (input.priorityId !== undefined) {
    push("priorityId", current.priority?.id ?? null, input.priorityId);
  }
  if (input.startDate !== undefined) {
    push("startDate", current.startDate, input.startDate);
  }
  if (input.dueDate !== undefined) {
    push("dueDate", current.dueDate, input.dueDate);
  }
  if (input.doneRatio !== undefined) {
    push("doneRatio", current.doneRatio ?? 0, input.doneRatio);
  }
  if (input.estimatedHours !== undefined) {
    push("estimatedHours", current.estimatedHours, input.estimatedHours);
  }
  if (assignee) {
    push(
      "assignedTo",
      current.assignedTo?.id ?? null,
      assignee.assignedTo === "me" ? "me" : assignee.assignedTo
    );
  }
  if (watchers) {
    push("watchers", "(current)", watchers.watcherUserIds);
  }
  if (input.notes !== undefined) {
    changes.push({ field: "notes", from: null, to: "(journal note)" });
  }

  if (!input.confirm) {
    return withIssuedToken("redmine_update_issue", input, {
      dryRun: true as const,
      issueId: input.issueId,
      changes,
      ...(assignee?.label ? { assignedToLabel: assignee.label } : {}),
      ...(watchers ? { watcherLabels: watchers.watcherLabels } : {}),
    });
  }

  consumeIfConfirm("redmine_update_issue", input);

  const result = await client.updateIssue({
    issueId: input.issueId,
    ...(input.subject !== undefined ? { subject: input.subject } : {}),
    ...(input.description !== undefined
      ? { description: input.description }
      : {}),
    ...(input.trackerId !== undefined ? { trackerId: input.trackerId } : {}),
    ...(input.statusId !== undefined ? { statusId: input.statusId } : {}),
    ...(input.priorityId !== undefined ? { priorityId: input.priorityId } : {}),
    ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
    ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
    ...(input.doneRatio !== undefined ? { doneRatio: input.doneRatio } : {}),
    ...(input.estimatedHours !== undefined
      ? { estimatedHours: input.estimatedHours }
      : {}),
    ...(assignee ? { assignedTo: assignee.assignedTo } : {}),
    ...(watchers ? { watcherUserIds: watchers.watcherUserIds } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  });
  return { dryRun: false as const, result, changes };
}

export async function handleAddComment(
  client: RedmineClient,
  input: AddCommentInput
) {
  const block = notesMarkupBlock(input.notes);
  if (block) {
    if (input.confirm) assertPlainNotesOrThrow(input.notes);
    return { dryRun: true as const, ...block };
  }

  const wouldApply = { issueId: input.issueId, notes: input.notes };
  if (!input.confirm) {
    return withIssuedToken("redmine_add_comment", input, {
      dryRun: true as const,
      wouldApply,
    });
  }
  consumeIfConfirm("redmine_add_comment", input);
  const result = await client.addComment(input.issueId, input.notes);
  return { dryRun: false as const, result };
}

export async function handleAddAttachment(
  client: RedmineClient,
  input: AddAttachmentInput
) {
  const attachments = attachmentWouldApply(client, input.attachments);
  const wouldApply = { issueId: input.issueId, attachments };
  if (!input.confirm) {
    return withIssuedToken("redmine_add_attachment", input, {
      dryRun: true as const,
      wouldApply,
    });
  }
  consumeIfConfirm("redmine_add_attachment", input);
  const uploads = await client.uploadAttachments(input.attachments);
  const result = await client.addIssueAttachments({
    issueId: input.issueId,
    uploads: uploads.map((u) => ({
      token: u.token,
      filename: u.filename,
      ...(u.description !== undefined ? { description: u.description } : {}),
    })),
  });
  return { dryRun: false as const, result };
}

export async function handleUpdateStatus(
  client: RedmineClient,
  input: UpdateStatusInput
) {
  if (input.notes !== undefined) {
    const block = notesMarkupBlock(input.notes);
    if (block) {
      if (input.confirm) assertPlainNotesOrThrow(input.notes);
      return { dryRun: true as const, ...block };
    }
  }

  const wouldApply = {
    issueId: input.issueId,
    statusId: input.statusId,
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  };
  if (!input.confirm) {
    return withIssuedToken("redmine_update_status", input, {
      dryRun: true as const,
      wouldApply,
    });
  }
  consumeIfConfirm("redmine_update_status", input);
  const result = await client.updateIssueStatus(
    input.issueId,
    input.statusId,
    input.notes
  );
  return { dryRun: false as const, result };
}
