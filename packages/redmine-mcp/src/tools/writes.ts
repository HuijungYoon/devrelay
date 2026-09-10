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
  BulkUpdateStatusInput,
  CreateIssueInput,
  UpdateIssueInput,
  UpdateStatusInput,
} from "./schemas.js";
import { consumeIfConfirm, withIssuedToken } from "./previewStore.js";
import {
  resolveCustomFields,
  resolveIssueMetadata,
  resolveNamedRef,
} from "./metadata.js";
import type { ResolvedCustomField } from "./metadata.js";

type NotesMarkupBlock = {
  blocked: true;
  reason: string;
  matches: string[];
};

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

/** dry-run 표시용: id·name·value (value ""는 비움) */
function customFieldsWouldApply(fields: ResolvedCustomField[]) {
  return fields.map((f) => ({
    id: f.id,
    ...(f.name !== undefined ? { name: f.name } : {}),
    value: f.value,
  }));
}

/** 실제 쓰기 payload: 이름은 빼고 id + value */
function customFieldsWrite(fields: ResolvedCustomField[]) {
  return fields.map((f) => ({ id: f.id, value: f.value }));
}

/** 이슈 상세의 custom_fields 값 (없으면 null) */
function currentCustomFieldValue(
  current: { customFields?: Array<{ id: number; value: unknown }> },
  id: number
): unknown {
  const found = current.customFields?.find((f) => f.id === id);
  if (!found) return null;
  return found.value ?? null;
}

/** ""·null·undefined는 같은 "비움"으로, 배열은 순서 무시하고 비교 */
function sameCustomFieldValue(a: unknown, b: unknown): boolean {
  const norm = (v: unknown): string => {
    if (Array.isArray(v)) return JSON.stringify(v.map(String).sort());
    if (v === null || v === undefined) return "";
    return String(v);
  };
  return norm(a) === norm(b);
}

async function loadMembers(
  client: RedmineClient,
  projectId: number
): Promise<RedmineUser[]> {
  // listProjectPeople falls back to recent assignees when the memberships
  // API is forbidden, which is the case on some Redmine instances.
  const { members } = await client.listProjectPeople({
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

/** Resolve assignedTo: "me" | userId | name → userId */
export async function resolveAssignedTo(
  client: RedmineClient,
  projectId: number,
  assignedTo: CreateIssueInput["assignedTo"],
  membersCache?: RedmineUser[]
): Promise<{ assignedTo: number; label?: string; members: RedmineUser[] } | undefined> {
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
  // Redmine only honors assigned_to_id=me in query filters; writes need the
  // numeric id, otherwise the issue is silently created unassigned.
  if (resolved.id === "me") {
    const me = await client.getCurrentUser();
    return {
      assignedTo: me.id,
      label: `${me.name} (me)`,
      members: resolved.members,
    };
  }
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
  const meta = await resolveIssueMetadata(client, input.projectId, input);
  const customFields = await resolveCustomFields(
    client,
    input.projectId,
    input.customFields
  );

  const wouldApply = {
    projectId: input.projectId,
    subject: input.subject,
    ...(input.description !== undefined
      ? { description: formatDescriptionForRedmine(input.description) }
      : {}),
    ...(input.parentIssueId !== undefined
      ? { parentIssueId: input.parentIssueId }
      : {}),
    ...meta,
    ...(customFields
      ? { customFields: customFieldsWouldApply(customFields) }
      : {}),
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
    ...(wouldApply.parentIssueId !== undefined
      ? { parentIssueId: wouldApply.parentIssueId }
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
    ...(wouldApply.fixedVersionId != null
      ? { fixedVersionId: wouldApply.fixedVersionId }
      : {}),
    ...(wouldApply.categoryId != null
      ? { categoryId: wouldApply.categoryId }
      : {}),
    ...(customFields ? { customFields: customFieldsWrite(customFields) } : {}),
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

  const meta = await resolveIssueMetadata(client, projectId, input);
  const customFields = await resolveCustomFields(
    client,
    projectId,
    input.customFields
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
  if (input.parentIssueId !== undefined) {
    if (input.parentIssueId === input.issueId) {
      throw new RedmineError({
        code: "REDMINE_VALIDATION_ERROR",
        message: `Issue #${input.issueId} cannot be its own 상위 일감`,
        check: ["Pass a different parentIssueId, or null to detach"],
      });
    }
    push("parentIssueId", current.parent?.id ?? null, input.parentIssueId);
  }
  if (meta.trackerId !== undefined) {
    push("trackerId", current.tracker?.id ?? null, meta.trackerId);
  }
  if (meta.statusId !== undefined) {
    push("statusId", current.status?.id ?? null, meta.statusId);
  }
  if (meta.priorityId !== undefined) {
    push("priorityId", current.priority?.id ?? null, meta.priorityId);
  }
  if (meta.fixedVersionId !== undefined) {
    push(
      "fixedVersionId",
      current.fixedVersion?.id ?? null,
      meta.fixedVersionId
    );
  }
  if (meta.categoryId !== undefined) {
    push("categoryId", current.category?.id ?? null, meta.categoryId);
  }
  if (customFields) {
    for (const f of customFields) {
      // 이슈 상세가 이름을 들고 있으니 목록을 못 읽었어도 여기서 채운다
      const label =
        f.name ?? current.customFields?.find((c) => c.id === f.id)?.name;
      const from = currentCustomFieldValue(current, f.id);
      if (sameCustomFieldValue(from, f.value)) continue;
      changes.push({
        field: `customField:${label ?? f.id}`,
        from,
        to: f.value,
      });
    }
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
    push("assignedTo", current.assignedTo?.id ?? null, assignee.assignedTo);
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
      ...(meta.trackerLabel ? { trackerLabel: meta.trackerLabel } : {}),
      ...(meta.statusLabel ? { statusLabel: meta.statusLabel } : {}),
      ...(meta.priorityLabel ? { priorityLabel: meta.priorityLabel } : {}),
      ...(meta.fixedVersionLabel
        ? { fixedVersionLabel: meta.fixedVersionLabel }
        : {}),
      ...(meta.categoryLabel ? { categoryLabel: meta.categoryLabel } : {}),
    });
  }

  consumeIfConfirm("redmine_update_issue", input);

  const result = await client.updateIssue({
    issueId: input.issueId,
    ...(input.subject !== undefined ? { subject: input.subject } : {}),
    ...(input.description !== undefined
      ? { description: input.description }
      : {}),
    ...(input.parentIssueId !== undefined
      ? { parentIssueId: input.parentIssueId }
      : {}),
    ...(meta.trackerId !== undefined ? { trackerId: meta.trackerId } : {}),
    ...(meta.statusId !== undefined ? { statusId: meta.statusId } : {}),
    ...(meta.priorityId !== undefined ? { priorityId: meta.priorityId } : {}),
    ...(meta.fixedVersionId !== undefined
      ? { fixedVersionId: meta.fixedVersionId }
      : {}),
    ...(meta.categoryId !== undefined ? { categoryId: meta.categoryId } : {}),
    ...(customFields ? { customFields: customFieldsWrite(customFields) } : {}),
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

  const status = await resolveNamedRef(
    client,
    "statuses",
    input.statusId,
    "statusId"
  );

  const wouldApply = {
    issueId: input.issueId,
    statusId: status.id,
    ...(status.label ? { statusLabel: status.label } : {}),
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
    status.id,
    input.notes
  );
  return { dryRun: false as const, result };
}

export type BulkStatusRow = {
  issueId: number;
  subject: string | null;
  from: { id: number; name: string } | null;
  to: { id: number; name?: string };
  /** 이미 그 상태라 건너뜀 */
  unchanged?: true;
  /** dry-run에서 이슈를 못 읽음 (없거나 권한 없음) */
  error?: string;
};

/**
 * 여러 일감을 같은 상태로. dry-run은 일감마다 현재 상태를 읽어 이전→이후 표를 만들고,
 * confirm은 한 건씩 적용하되 하나가 실패해도 나머지를 계속 진행해 성공·실패를 나눠 돌려준다.
 * (Redmine에 일괄 API가 없어 요청 수는 일감 수와 같다.)
 */
export async function handleBulkUpdateStatus(
  client: RedmineClient,
  input: BulkUpdateStatusInput
) {
  if (input.notes !== undefined) {
    const block = notesMarkupBlock(input.notes);
    if (block) {
      if (input.confirm) assertPlainNotesOrThrow(input.notes);
      return { dryRun: true as const, ...block };
    }
  }

  const status = await resolveNamedRef(
    client,
    "statuses",
    input.statusId,
    "statusId"
  );
  const to = { id: status.id, ...(status.label ? { name: status.label } : {}) };

  const rows: BulkStatusRow[] = [];
  for (const issueId of input.issueIds) {
    try {
      const issue = await client.getIssue(issueId);
      const row: BulkStatusRow = {
        issueId,
        subject: issue.subject ?? null,
        from: issue.status ?? null,
        to,
      };
      if (issue.status?.id === status.id) row.unchanged = true;
      rows.push(row);
    } catch (err) {
      rows.push({
        issueId,
        subject: null,
        from: null,
        to,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const willChange = rows.filter((r) => !r.unchanged && !r.error);
  const summary = {
    total: rows.length,
    willChange: willChange.length,
    unchanged: rows.filter((r) => r.unchanged).length,
    unreadable: rows.filter((r) => r.error).length,
  };

  if (!input.confirm) {
    return withIssuedToken("redmine_bulk_update_status", input, {
      dryRun: true as const,
      statusId: status.id,
      ...(status.label ? { statusLabel: status.label } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      rows,
      summary,
    });
  }

  consumeIfConfirm("redmine_bulk_update_status", input);

  const updated: Array<{
    issueId: number;
    status: { id: number; name: string } | null;
  }> = [];
  const failed: Array<{ issueId: number; error: string }> = [];
  const skipped = rows.filter((r) => r.unchanged).map((r) => r.issueId);
  for (const row of willChange) {
    try {
      const result = await client.updateIssueStatus(
        row.issueId,
        status.id,
        input.notes
      );
      updated.push({ issueId: row.issueId, status: result.status });
    } catch (err) {
      failed.push({
        issueId: row.issueId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  // dry-run에서 못 읽은 일감은 confirm에서도 건드리지 않는다
  for (const row of rows) {
    if (row.error) failed.push({ issueId: row.issueId, error: row.error });
  }

  return {
    dryRun: false as const,
    statusId: status.id,
    ...(status.label ? { statusLabel: status.label } : {}),
    updated,
    skipped,
    failed,
  };
}
