export type RedmineUser = {
  id: number;
  login: string;
  name: string;
};

export type RedmineProject = {
  id: number;
  identifier: string;
  name: string;
  description: string;
  isPublic: boolean;
  parent: { id: number; name: string } | null;
  status: number;
};

export type ListProjectsResult = {
  projects: RedmineProject[];
  totalCount: number;
  returnedCount: number;
  hasMore: boolean;
};

export type IssueInclude =
  | "journals"
  | "attachments"
  | "relations"
  | "children"
  | "allowed_statuses";

export type NormalizedIssueSummary = {
  id: number;
  subject: string;
  project: { id: number; name: string } | null;
  tracker: { id: number; name: string } | null;
  status: { id: number; name: string } | null;
  priority: { id: number; name: string } | null;
  assignedTo: { id: number; name: string } | null;
  updatedOn: string | null;
  createdOn: string | null;
};

export type NormalizedIssueDetail = NormalizedIssueSummary & {
  description: string;
  author: { id: number; name: string } | null;
  startDate: string | null;
  dueDate: string | null;
  doneRatio: number | null;
  estimatedHours: number | null;
  parent: { id: number } | null;
  customFields: Array<{ id: number; name: string; value: unknown }>;
  journals?: Array<{
    id: number;
    user: { id: number; name: string } | null;
    notes: string;
    createdOn: string;
    privateNotes: boolean;
  }>;
  attachments?: Array<{
    id: number;
    filename: string;
    filesize: number;
    contentType: string;
    createdOn: string;
  }>;
  relations?: unknown[];
  children?: unknown[];
  allowedStatuses?: Array<{ id: number; name: string }>;
};

export type SearchIssuesInput = {
  projectId?: number;
  issueId?: number;
  assignedTo?: string | number;
  status?: "open" | "closed" | "all" | number;
  trackerId?: number;
  priorityId?: number;
  subjectContains?: string;
  createdAfter?: string;
  updatedAfter?: string;
  parentIssueId?: number;
  customFields?: Array<{ id: number; value: string }>;
  sort?: Array<{ field: string; direction: "asc" | "desc" }>;
  limit?: number;
  offset?: number;
};

export type AttachmentInput = {
  path: string;
  filename?: string;
  description?: string;
};

export type AttachmentPreview = {
  path: string;
  filename: string;
  sizeBytes: number;
  description?: string;
};

export type UploadedAttachment = {
  token: string;
  filename: string;
  description?: string;
  sizeBytes: number;
};

export type IssueUploadToken = {
  token: string;
  filename: string;
  description?: string;
};

export const ATTACHMENT_MAX_FILES = 5;
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/** Redmine relation_type values (연결된 일감 관계 종류) */
export const ISSUE_RELATION_TYPES = [
  "relates",
  "duplicates",
  "duplicated",
  "blocks",
  "blocked",
  "precedes",
  "follows",
  "copied_to",
  "copied_from",
] as const;

export type IssueRelationType = (typeof ISSUE_RELATION_TYPES)[number];

/** Relation types that accept a delay (in days) */
export const DELAY_RELATION_TYPES = ["precedes", "follows"] as const;

export type IssueRelation = {
  id: number;
  issueId: number;
  issueToId: number;
  relationType: string;
  delay: number | null;
};

export type ListIssueRelationsResult = {
  issueId: number;
  relations: IssueRelation[];
  totalCount: number;
};

export type AddIssueRelationInput = {
  issueId: number;
  issueToId: number;
  relationType: IssueRelationType;
  delay?: number | null;
};

export type RemoveIssueRelationResult = {
  relationId: number;
  removed: true;
};

export type ReplaceIssueRelationInput = {
  relationId: number;
  issueToId?: number;
  relationType?: IssueRelationType;
  delay?: number | null;
};

export type ReplaceIssueRelationResult = {
  removedRelationId: number;
  relation: IssueRelation;
};

export type CreateIssueInput = {
  projectId: number;
  subject: string;
  description?: string;
  /** 상위 일감 (parent_issue_id) — creates this issue as a subtask */
  parentIssueId?: number;
  trackerId?: number;
  statusId?: number;
  priorityId?: number;
  startDate?: string;
  dueDate?: string;
  doneRatio?: number;
  estimatedHours?: number;
  /** "me", numeric user id (담당자) */
  assignedTo?: "me" | number;
  /** 일감관리자 — Redmine watcher_user_ids */
  watcherUserIds?: number[];
  /** Pre-uploaded Redmine upload tokens */
  uploads?: IssueUploadToken[];
};

export type AddIssueAttachmentsInput = {
  issueId: number;
  uploads: IssueUploadToken[];
};

export type AddIssueAttachmentsResult = {
  issueId: number;
  uploadedCount: number;
};

export type UpdateIssueInput = {
  issueId: number;
  subject?: string;
  description?: string;
  /** 상위 일감 — number attaches/moves, null detaches (하위일감 연결 해제) */
  parentIssueId?: number | null;
  trackerId?: number;
  statusId?: number;
  priorityId?: number;
  startDate?: string;
  dueDate?: string;
  doneRatio?: number;
  estimatedHours?: number;
  assignedTo?: "me" | number;
  /** replace-all when provided (including empty) */
  watcherUserIds?: number[];
  notes?: string;
};

export type UpdateIssueResult = {
  issueId: number;
  subject?: string;
  status: { id: number; name: string } | null;
  parentIssueId?: number | null;
};

export type SearchUsersResult = {
  users: RedmineUser[];
  totalCount: number;
  returnedCount: number;
};

export type ListProjectMembersResult = {
  projectId: number;
  members: RedmineUser[];
  totalCount: number;
  returnedCount: number;
};

export type CreateIssueResult = {
  id: number;
  subject: string;
  project: { id: number; name: string } | null;
  status: { id: number; name: string } | null;
};

export type AddCommentResult = {
  issueId: number;
  updated: true;
};

export type UpdateStatusResult = {
  issueId: number;
  status: { id: number; name: string } | null;
};

export type SearchIssuesResult = {
  issues: NormalizedIssueSummary[];
  totalCount: number;
  returnedCount: number;
  hasMore: boolean;
};
