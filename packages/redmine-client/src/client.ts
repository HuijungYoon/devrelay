import type { RedmineConfig } from "./config.js";
import { loadConfig } from "./config.js";
import { RedmineHttp } from "./http.js";
import type {
  AddCommentResult,
  AddIssueAttachmentsInput,
  AddIssueAttachmentsResult,
  AddIssueRelationInput,
  AttachmentInput,
  AttachmentPreview,
  CreateIssueInput,
  CreateIssueResult,
  IssueCategoryOption,
  IssueInclude,
  IssuePriorityOption,
  IssueRelation,
  IssueStatusOption,
  ListIssueRelationsResult,
  ListProjectMembersResult,
  ProjectVersionOption,
  RedmineNamed,
  ListProjectsResult,
  NormalizedIssueDetail,
  RedmineProject,
  RedmineUser,
  RemoveIssueRelationResult,
  ReplaceIssueRelationInput,
  ReplaceIssueRelationResult,
  SearchIssuesInput,
  SearchIssuesResult,
  SearchUsersResult,
  UpdateIssueInput,
  UpdateIssueResult,
  UpdateStatusResult,
  UploadedAttachment,
} from "./types.js";
import { getIssue, searchIssues } from "./issues.js";
import {
  listIssueCategories,
  listIssuePriorities,
  listIssueStatuses,
  listProjectVersions,
  listTrackers,
} from "./metadata.js";
import {
  addIssueRelation,
  getIssueRelation,
  listIssueRelations,
  removeIssueRelation,
  replaceIssueRelation,
} from "./relations.js";
import { listProjectMembers, listProjectPeople } from "./memberships.js";
import { searchUsers } from "./users.js";
import {
  inspectAttachments,
  uploadAttachments,
  uploadFile,
} from "./attachments.js";
import {
  addComment,
  addIssueAttachments,
  createIssue,
  updateIssue,
  updateIssueStatus,
} from "./writes.js";

type RawUser = {
  user: {
    id: number;
    login: string;
    firstname?: string;
    lastname?: string;
  };
};

type RawProject = {
  id: number;
  identifier: string;
  name: string;
  description?: string;
  is_public?: boolean;
  parent?: { id: number; name: string } | null;
  status?: number;
};

type RawProjectsResponse = {
  projects: RawProject[];
  total_count: number;
  offset: number;
  limit: number;
};

function normalizeUser(raw: RawUser["user"]): RedmineUser {
  const name = [raw.lastname, raw.firstname].filter(Boolean).join(" ").trim();
  return {
    id: raw.id,
    login: raw.login,
    name: name || raw.login,
  };
}

function normalizeProject(raw: RawProject): RedmineProject {
  return {
    id: raw.id,
    identifier: raw.identifier,
    name: raw.name,
    description: raw.description ?? "",
    isPublic: Boolean(raw.is_public),
    parent: raw.parent ?? null,
    status: raw.status ?? 1,
  };
}

export class RedmineClient {
  constructor(
    readonly http: RedmineHttp,
    readonly config: RedmineConfig
  ) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): RedmineClient {
    const config = loadConfig(env);
    return new RedmineClient(new RedmineHttp(config), config);
  }

  static fromConfig(config: RedmineConfig): RedmineClient {
    return new RedmineClient(new RedmineHttp(config), config);
  }

  async getCurrentUser(): Promise<RedmineUser> {
    const data = await this.http.getJson<RawUser>("/users/current.json");
    return normalizeUser(data.user);
  }

  async listProjects(opts: {
    search?: string;
    limit?: number;
  } = {}): Promise<ListProjectsResult> {
    const wanted = Math.min(
      opts.limit ?? this.config.maxResultCount,
      this.config.maxResultCount
    );
    const pageSize = Math.min(100, wanted);
    const collected: RedmineProject[] = [];
    let offset = 0;
    let totalCount = 0;

    while (collected.length < wanted) {
      const page = await this.http.getJson<RawProjectsResponse>(
        "/projects.json",
        { limit: pageSize, offset }
      );
      totalCount = page.total_count;
      collected.push(...page.projects.map(normalizeProject));
      offset += page.projects.length;
      if (page.projects.length === 0 || offset >= totalCount) break;
    }

    let projects = collected;
    if (opts.search) {
      const q = opts.search.toLowerCase();
      projects = projects.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.identifier.toLowerCase().includes(q)
      );
    }
    projects = projects.slice(0, wanted);

    return {
      projects,
      totalCount,
      returnedCount: projects.length,
      hasMore: offset < totalCount && projects.length >= wanted,
    };
  }

  searchIssues(input: SearchIssuesInput = {}): Promise<SearchIssuesResult> {
    return searchIssues(this.http, this.config, input);
  }

  searchUsers(opts: {
    query?: string;
    limit?: number;
  } = {}): Promise<SearchUsersResult> {
    return searchUsers(this.http, this.config, opts);
  }

  listProjectMembers(opts: {
    projectId: number;
    query?: string;
    limit?: number;
  }): Promise<ListProjectMembersResult> {
    return listProjectMembers(this.http, this.config, opts);
  }

  /** 담당자·일감관리자 후보. 멤버 목록이 403이면 최근 이슈에서 추립니다. */
  listProjectPeople(opts: {
    projectId: number;
    query?: string;
    limit?: number;
  }): Promise<ListProjectMembersResult> {
    return listProjectPeople(this.http, this.config, opts);
  }

  getIssue(
    issueId: number,
    opts: { include?: IssueInclude[] } = {}
  ): Promise<NormalizedIssueDetail> {
    return getIssue(this.http, issueId, opts);
  }

  createIssue(input: CreateIssueInput): Promise<CreateIssueResult> {
    return createIssue(this.http, input);
  }

  updateIssue(input: UpdateIssueInput): Promise<UpdateIssueResult> {
    return updateIssue(this.http, input);
  }

  /** 유형 목록 (이름 → id 해석용) */
  listTrackers(): Promise<RedmineNamed[]> {
    return listTrackers(this.http);
  }

  /** 상태 목록 */
  listIssueStatuses(): Promise<IssueStatusOption[]> {
    return listIssueStatuses(this.http);
  }

  /** 우선순위 목록 */
  listIssuePriorities(): Promise<IssuePriorityOption[]> {
    return listIssuePriorities(this.http);
  }

  /** 대상 버전 목록 (프로젝트별) */
  listProjectVersions(projectId: number): Promise<ProjectVersionOption[]> {
    return listProjectVersions(this.http, projectId);
  }

  /** 범주 목록 (프로젝트별) */
  listIssueCategories(projectId: number): Promise<IssueCategoryOption[]> {
    return listIssueCategories(this.http, projectId);
  }

  /** 연결된 일감 목록 (GET /issues/:id/relations.json) */
  listIssueRelations(issueId: number): Promise<ListIssueRelationsResult> {
    return listIssueRelations(this.http, issueId);
  }

  getIssueRelation(relationId: number): Promise<IssueRelation> {
    return getIssueRelation(this.http, relationId);
  }

  addIssueRelation(input: AddIssueRelationInput): Promise<IssueRelation> {
    return addIssueRelation(this.http, input);
  }

  removeIssueRelation(
    relationId: number
  ): Promise<RemoveIssueRelationResult> {
    return removeIssueRelation(this.http, relationId);
  }

  /** Change a relation (delete + re-create; Redmine has no update endpoint) */
  replaceIssueRelation(
    input: ReplaceIssueRelationInput
  ): Promise<ReplaceIssueRelationResult> {
    return replaceIssueRelation(this.http, input);
  }

  inspectAttachments(inputs: AttachmentInput[]): AttachmentPreview[] {
    return inspectAttachments(inputs);
  }

  uploadFile(input: AttachmentInput): Promise<UploadedAttachment> {
    return uploadFile(this.http, input);
  }

  uploadAttachments(inputs: AttachmentInput[]): Promise<UploadedAttachment[]> {
    return uploadAttachments(this.http, inputs);
  }

  addIssueAttachments(
    input: AddIssueAttachmentsInput
  ): Promise<AddIssueAttachmentsResult> {
    return addIssueAttachments(this.http, input);
  }

  addComment(issueId: number, notes: string): Promise<AddCommentResult> {
    return addComment(this.http, issueId, notes);
  }

  updateIssueStatus(
    issueId: number,
    statusId: number,
    notes?: string
  ): Promise<UpdateStatusResult> {
    return updateIssueStatus(this.http, issueId, statusId, notes);
  }
}
