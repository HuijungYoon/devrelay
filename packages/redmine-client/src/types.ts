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

export type CreateIssueInput = {
  projectId: number;
  subject: string;
  description?: string;
  trackerId?: number;
  priorityId?: number;
  /** "me", numeric user id, or (MCP) display name/login resolved before create */
  assignedTo?: "me" | number;
};

export type SearchUsersResult = {
  users: RedmineUser[];
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
