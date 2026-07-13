import { z } from "zod";

const positiveInt = z.number().int().positive();

export const connectionInputSchema = z.object({}).strict();

export const listProjectsInputSchema = z
  .object({
    search: z.string().optional(),
    limit: z.number().int().positive().max(1000).optional(),
  })
  .strict();

export const searchIssuesInputSchema = z
  .object({
    projectId: positiveInt.optional(),
    issueId: positiveInt.optional(),
    assignedTo: z.union([z.literal("me"), positiveInt, z.string()]).optional(),
    status: z
      .union([
        z.literal("open"),
        z.literal("closed"),
        z.literal("all"),
        positiveInt,
      ])
      .optional(),
    trackerId: positiveInt.optional(),
    priorityId: positiveInt.optional(),
    subjectContains: z.string().optional(),
    createdAfter: z.string().optional(),
    updatedAfter: z.string().optional(),
    parentIssueId: positiveInt.optional(),
    customFields: z
      .array(
        z
          .object({
            id: positiveInt,
            value: z.string(),
          })
          .strict()
      )
      .optional(),
    sort: z
      .array(
        z
          .object({
            field: z.string(),
            direction: z.enum(["asc", "desc"]),
          })
          .strict()
      )
      .optional(),
    limit: z.number().int().positive().max(1000).optional(),
    offset: z.number().int().nonnegative().optional(),
  })
  .strict();

export const getIssueInputSchema = z
  .object({
    issueId: positiveInt,
    include: z
      .array(
        z.enum([
          "journals",
          "attachments",
          "relations",
          "children",
          "allowed_statuses",
        ])
      )
      .optional(),
  })
  .strict();

export const createIssueInputSchema = z
  .object({
    projectId: positiveInt,
    subject: z.string().min(1),
    description: z.string().optional(),
    trackerId: positiveInt.optional(),
    priorityId: positiveInt.optional(),
    assignedTo: z
      .union([z.literal("me"), positiveInt, z.string().min(1)])
      .optional(),
    /** 일감관리자 (Redmine watchers) — ids, "me", or names */
    watchers: z
      .array(z.union([z.literal("me"), positiveInt, z.string().min(1)]))
      .optional(),
    confirm: z.boolean().optional(),
  })
  .strict();

export const searchUsersInputSchema = z
  .object({
    query: z.string().optional(),
    limit: z.number().int().positive().max(1000).optional(),
  })
  .strict();

export const listProjectMembersInputSchema = z
  .object({
    projectId: positiveInt,
    query: z.string().optional(),
    limit: z.number().int().positive().max(1000).optional(),
  })
  .strict();

export const addCommentInputSchema = z
  .object({
    issueId: positiveInt,
    notes: z.string().min(1),
    confirm: z.boolean().optional(),
  })
  .strict();

export const updateStatusInputSchema = z
  .object({
    issueId: positiveInt,
    statusId: positiveInt,
    notes: z.string().optional(),
    confirm: z.boolean().optional(),
  })
  .strict();

export type ConnectionInput = z.infer<typeof connectionInputSchema>;
export type ListProjectsInput = z.infer<typeof listProjectsInputSchema>;
export type SearchIssuesInput = z.infer<typeof searchIssuesInputSchema>;
export type GetIssueInput = z.infer<typeof getIssueInputSchema>;
export type CreateIssueInput = z.infer<typeof createIssueInputSchema>;
export type SearchUsersInput = z.infer<typeof searchUsersInputSchema>;
export type ListProjectMembersInput = z.infer<
  typeof listProjectMembersInputSchema
>;
export type AddCommentInput = z.infer<typeof addCommentInputSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusInputSchema>;

export function safeParseConnection(input: unknown) {
  return connectionInputSchema.safeParse(input ?? {});
}

export function safeParseListProjects(input: unknown) {
  return listProjectsInputSchema.safeParse(input ?? {});
}

export function safeParseSearch(input: unknown) {
  return searchIssuesInputSchema.safeParse(input ?? {});
}

export function safeParseGetIssue(input: unknown) {
  return getIssueInputSchema.safeParse(input);
}

export function safeParseCreateIssue(input: unknown) {
  return createIssueInputSchema.safeParse(input ?? {});
}

export function safeParseSearchUsers(input: unknown) {
  return searchUsersInputSchema.safeParse(input ?? {});
}

export function safeParseListProjectMembers(input: unknown) {
  return listProjectMembersInputSchema.safeParse(input ?? {});
}

export function safeParseAddComment(input: unknown) {
  return addCommentInputSchema.safeParse(input ?? {});
}

export function safeParseUpdateStatus(input: unknown) {
  return updateStatusInputSchema.safeParse(input ?? {});
}

/** JSON Schema objects for MCP ListTools (additionalProperties: false). */
export const toolJsonSchemas = {
  redmine_test_connection: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  redmine_list_projects: {
    type: "object",
    properties: {
      search: { type: "string" },
      limit: { type: "integer", minimum: 1 },
    },
    additionalProperties: false,
  },
  redmine_search_issues: {
    type: "object",
    properties: {
      projectId: { type: "integer", minimum: 1 },
      issueId: { type: "integer", minimum: 1 },
      assignedTo: {
        oneOf: [
          { type: "string" },
          { type: "integer", minimum: 1 },
        ],
      },
      status: {
        oneOf: [
          { type: "string", enum: ["open", "closed", "all"] },
          { type: "integer", minimum: 1 },
        ],
      },
      trackerId: { type: "integer", minimum: 1 },
      priorityId: { type: "integer", minimum: 1 },
      subjectContains: { type: "string" },
      createdAfter: { type: "string" },
      updatedAfter: { type: "string" },
      parentIssueId: { type: "integer", minimum: 1 },
      customFields: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "integer", minimum: 1 },
            value: { type: "string" },
          },
          required: ["id", "value"],
          additionalProperties: false,
        },
      },
      sort: {
        type: "array",
        items: {
          type: "object",
          properties: {
            field: { type: "string" },
            direction: { type: "string", enum: ["asc", "desc"] },
          },
          required: ["field", "direction"],
          additionalProperties: false,
        },
      },
      limit: { type: "integer", minimum: 1 },
      offset: { type: "integer", minimum: 0 },
    },
    additionalProperties: false,
  },
  redmine_get_issue: {
    type: "object",
    properties: {
      issueId: { type: "integer", minimum: 1 },
      include: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "journals",
            "attachments",
            "relations",
            "children",
            "allowed_statuses",
          ],
        },
      },
    },
    required: ["issueId"],
    additionalProperties: false,
  },
  redmine_create_issue: {
    type: "object",
    properties: {
      projectId: {
        type: "integer",
        minimum: 1,
        description: "Redmine project id (required)",
      },
      subject: {
        type: "string",
        minLength: 1,
        description: "Issue subject/title (required)",
      },
      description: { type: "string", description: "Issue description body" },
      trackerId: { type: "integer", minimum: 1 },
      priorityId: { type: "integer", minimum: 1 },
      assignedTo: {
        description:
          '담당자 (assignee): "me", user id, or name matched in project members',
        oneOf: [
          { type: "string", const: "me" },
          { type: "integer", minimum: 1 },
          { type: "string", minLength: 1 },
        ],
      },
      watchers: {
        description:
          '일감관리자 (Redmine watchers): array of "me", user ids, or names — any members, not hardcoded',
        type: "array",
        items: {
          oneOf: [
            { type: "string", const: "me" },
            { type: "integer", minimum: 1 },
            { type: "string", minLength: 1 },
          ],
        },
      },
      confirm: {
        type: "boolean",
        description: "false/omit = dry-run preview; true = create",
      },
    },
    required: ["projectId", "subject"],
    additionalProperties: false,
  },
  redmine_search_users: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Filter by name or login (partial match)",
      },
      limit: { type: "integer", minimum: 1, maximum: 1000 },
    },
    additionalProperties: false,
  },
  redmine_list_project_members: {
    type: "object",
    properties: {
      projectId: {
        type: "integer",
        minimum: 1,
        description: "Project id whose members to list (for 담당자/일감관리자)",
      },
      query: {
        type: "string",
        description: "Optional name filter",
      },
      limit: { type: "integer", minimum: 1, maximum: 1000 },
    },
    required: ["projectId"],
    additionalProperties: false,
  },
  redmine_add_comment: {
    type: "object",
    properties: {
      issueId: { type: "integer", minimum: 1 },
      notes: { type: "string", minLength: 1 },
      confirm: { type: "boolean" },
    },
    required: ["issueId", "notes"],
    additionalProperties: false,
  },
  redmine_update_status: {
    type: "object",
    properties: {
      issueId: { type: "integer", minimum: 1 },
      statusId: { type: "integer", minimum: 1 },
      notes: { type: "string" },
      confirm: { type: "boolean" },
    },
    required: ["issueId", "statusId"],
    additionalProperties: false,
  },
} as const;
