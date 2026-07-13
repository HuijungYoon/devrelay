import type { RedmineConfig } from "./config.js";
import { loadConfig } from "./config.js";
import { RedmineHttp } from "./http.js";
import type {
  AddCommentResult,
  CreateIssueInput,
  CreateIssueResult,
  IssueInclude,
  ListProjectMembersResult,
  ListProjectsResult,
  NormalizedIssueDetail,
  RedmineProject,
  RedmineUser,
  SearchIssuesInput,
  SearchIssuesResult,
  SearchUsersResult,
  UpdateIssueInput,
  UpdateIssueResult,
  UpdateStatusResult,
} from "./types.js";
import { getIssue, searchIssues } from "./issues.js";
import { listProjectMembers } from "./memberships.js";
import { searchUsers } from "./users.js";
import {
  addComment,
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
