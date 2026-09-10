import { z } from "zod";
import {
  ATTACHMENT_DOWNLOAD_HARD_MAX_BYTES,
  ISSUE_RELATION_TYPES,
  SEARCH_TEXT_TYPES,
} from "redmine-devrelay-client";

const positiveInt = z.number().int().positive();
const ymdFilter = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** "me" | user id | 이름 */
const userFilter = z.union([z.literal("me"), positiveInt, z.string().min(1)]);
/** id 또는 이름 (검색 필터용) */
const namedFilter = z.union([positiveInt, z.string().min(1)]);

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
    assignedTo: userFilter.optional(),
    authorId: userFilter.optional(),
    watcherId: userFilter.optional(),
    /** open | closed | all | status id | 상태 이름 */
    status: z
      .union([
        z.literal("open"),
        z.literal("closed"),
        z.literal("all"),
        positiveInt,
        z.string().min(1),
      ])
      .optional(),
    trackerId: namedFilter.optional(),
    priorityId: namedFilter.optional(),
    fixedVersionId: namedFilter.optional(),
    categoryId: namedFilter.optional(),
    subjectContains: z.string().optional(),
    createdAfter: ymdFilter.optional(),
    createdBefore: ymdFilter.optional(),
    updatedAfter: ymdFilter.optional(),
    updatedBefore: ymdFilter.optional(),
    dueAfter: ymdFilter.optional(),
    dueBefore: ymdFilter.optional(),
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
  .strict()
  .superRefine((v, ctx) => {
    const pairs: Array<[string, string | undefined, string, string | undefined]> = [
      ["createdAfter", v.createdAfter, "createdBefore", v.createdBefore],
      ["updatedAfter", v.updatedAfter, "updatedBefore", v.updatedBefore],
      ["dueAfter", v.dueAfter, "dueBefore", v.dueBefore],
    ];
    for (const [fromKey, from, toKey, to] of pairs) {
      if (from && to && from > to) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${fromKey} must not be after ${toKey}`,
          path: [fromKey],
        });
      }
    }
  });

/** 전문 검색 (본문·댓글·위키) */
export const searchTextInputSchema = z
  .object({
    query: z.string().min(1),
    projectId: positiveInt.optional(),
    types: z.array(z.enum(SEARCH_TEXT_TYPES)).min(1).optional(),
    titlesOnly: z.boolean().optional(),
    openIssuesOnly: z.boolean().optional(),
    allWords: z.boolean().optional(),
    limit: z.number().int().positive().max(100).optional(),
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

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const doneRatio = z.number().int().min(0).max(100);
const userRef = z.union([z.literal("me"), positiveInt, z.string().min(1)]);
/** id 또는 이름 (유형·상태·우선순위·버전·범주) */
const namedRef = z.union([positiveInt, z.string().min(1)]);
/** id·이름, 또는 null(비우기) */
const nullableNamedRef = z.union([positiveInt, z.string().min(1), z.null()]);

/** 사용자 정의 필드 한 개: id 또는 name 중 하나 + value ("" = 비움, 배열 = 다중 선택) */
export const customFieldWriteSchema = z
  .object({
    id: positiveInt.optional(),
    name: z.string().min(1).optional(),
    value: z.union([z.string(), z.array(z.string())]),
  })
  .strict()
  .refine((v) => (v.id === undefined) !== (v.name === undefined), {
    message: "customFields[] entries need exactly one of id or name",
  });

const customFieldsField = z.array(customFieldWriteSchema).min(1).optional();

export const attachmentInputSchema = z
  .object({
    path: z.string().min(1),
    filename: z.string().min(1).optional(),
    description: z.string().optional(),
  })
  .strict();

const attachmentsField = z
  .array(attachmentInputSchema)
  .min(1)
  .max(5)
  .optional();

const confirmFields = {
  confirm: z.boolean().optional(),
  previewToken: z.string().min(1).optional(),
};

const requirePreviewTokenWhenConfirm = (
  v: { confirm?: boolean; previewToken?: string },
  ctx: z.RefinementCtx
) => {
  if (v.confirm === true && !v.previewToken) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "previewToken is required when confirm=true",
      path: ["previewToken"],
    });
  }
};

export const createIssueInputSchema = z
  .object({
    projectId: positiveInt,
    subject: z.string().min(1),
    description: z.string().optional(),
    parentIssueId: positiveInt.optional(),
    trackerId: namedRef.optional(),
    statusId: namedRef.optional(),
    priorityId: namedRef.optional(),
    fixedVersionId: namedRef.optional(),
    categoryId: namedRef.optional(),
    customFields: customFieldsField,
    startDate: ymd.optional(),
    dueDate: ymd.optional(),
    doneRatio: doneRatio.optional(),
    estimatedHours: z.number().positive().optional(),
    assignedTo: userRef.optional(),
    watchers: z.array(userRef).optional(),
    attachments: attachmentsField,
    ...confirmFields,
  })
  .strict()
  .superRefine(requirePreviewTokenWhenConfirm);

export const updateIssueInputSchema = z
  .object({
    issueId: positiveInt,
    subject: z.string().min(1).optional(),
    description: z.string().optional(),
    /** number = 하위일감으로 편입/부모 변경, null = 부모 연결 해제 */
    parentIssueId: z.union([positiveInt, z.null()]).optional(),
    trackerId: namedRef.optional(),
    statusId: namedRef.optional(),
    priorityId: namedRef.optional(),
    fixedVersionId: nullableNamedRef.optional(),
    categoryId: nullableNamedRef.optional(),
    customFields: customFieldsField,
    startDate: ymd.optional(),
    dueDate: ymd.optional(),
    doneRatio: doneRatio.optional(),
    estimatedHours: z.number().positive().optional(),
    assignedTo: userRef.optional(),
    watchers: z.array(userRef).optional(),
    notes: z.string().optional(),
    ...confirmFields,
  })
  .strict()
  .refine(
    (v) =>
      v.subject !== undefined ||
      v.description !== undefined ||
      v.parentIssueId !== undefined ||
      v.trackerId !== undefined ||
      v.statusId !== undefined ||
      v.priorityId !== undefined ||
      v.fixedVersionId !== undefined ||
      v.categoryId !== undefined ||
      v.customFields !== undefined ||
      v.startDate !== undefined ||
      v.dueDate !== undefined ||
      v.doneRatio !== undefined ||
      v.estimatedHours !== undefined ||
      v.assignedTo !== undefined ||
      v.watchers !== undefined,
    { message: "At least one field to update is required" }
  )
  .superRefine(requirePreviewTokenWhenConfirm);

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
    ...confirmFields,
  })
  .strict()
  .superRefine(requirePreviewTokenWhenConfirm);

export const addAttachmentInputSchema = z
  .object({
    issueId: positiveInt,
    attachments: z.array(attachmentInputSchema).min(1).max(5),
    ...confirmFields,
  })
  .strict()
  .superRefine(requirePreviewTokenWhenConfirm);

export const updateStatusInputSchema = z
  .object({
    issueId: positiveInt,
    statusId: namedRef,
    notes: z.string().optional(),
    ...confirmFields,
  })
  .strict()
  .superRefine(requirePreviewTokenWhenConfirm);

export const listMetadataInputSchema = z
  .object({
    projectId: positiveInt.optional(),
    kinds: z
      .array(
        z.enum([
          "trackers",
          "statuses",
          "priorities",
          "versions",
          "categories",
          "customFields",
          "activities",
        ])
      )
      .optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const needsProject = (v.kinds ?? []).filter(
      (k) => k === "versions" || k === "categories" || k === "customFields"
    );
    if (needsProject.length > 0 && v.projectId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${needsProject.join("/")} requires projectId`,
        path: ["projectId"],
      });
    }
  });

const relationType = z.enum(ISSUE_RELATION_TYPES);
const relationDelay = z.number().int();

export const listIssueRelationsInputSchema = z
  .object({
    issueId: positiveInt,
  })
  .strict();

export const addIssueRelationInputSchema = z
  .object({
    issueId: positiveInt,
    issueToId: positiveInt,
    relationType: relationType,
    delay: relationDelay.optional(),
    ...confirmFields,
  })
  .strict()
  .refine((v) => v.issueId !== v.issueToId, {
    message: "issueToId must differ from issueId",
    path: ["issueToId"],
  })
  .superRefine(requirePreviewTokenWhenConfirm);

export const updateIssueRelationInputSchema = z
  .object({
    relationId: positiveInt,
    issueToId: positiveInt.optional(),
    relationType: relationType.optional(),
    delay: z.union([relationDelay, z.null()]).optional(),
    ...confirmFields,
  })
  .strict()
  .refine(
    (v) =>
      v.issueToId !== undefined ||
      v.relationType !== undefined ||
      v.delay !== undefined,
    { message: "At least one of issueToId/relationType/delay is required" }
  )
  .superRefine(requirePreviewTokenWhenConfirm);

export const removeIssueRelationInputSchema = z
  .object({
    relationId: positiveInt,
    ...confirmFields,
  })
  .strict()
  .superRefine(requirePreviewTokenWhenConfirm);

/** 일괄 상태 변경 — 한 번의 미리보기로 여러 일감 (최대 50) */
export const bulkUpdateStatusInputSchema = z
  .object({
    issueIds: z.array(positiveInt).min(1).max(50),
    statusId: namedRef,
    notes: z.string().optional(),
    ...confirmFields,
  })
  .strict()
  .refine((v) => new Set(v.issueIds).size === v.issueIds.length, {
    message: "issueIds must not repeat",
    path: ["issueIds"],
  })
  .superRefine(requirePreviewTokenWhenConfirm);

/** 첨부 내려받기 — 읽기 도구. destDir은 MCP 호스트의 폴더 */
export const getAttachmentInputSchema = z
  .object({
    attachmentId: positiveInt,
    destDir: z.string().min(1).optional(),
    maxBytes: z
      .number()
      .int()
      .positive()
      .max(ATTACHMENT_DOWNLOAD_HARD_MAX_BYTES)
      .optional(),
    inlineText: z.boolean().optional(),
  })
  .strict();

/** 작업시간 기록 — 일감 또는 프로젝트 중 하나, hours는 0 초과 24 이하 */
export const logTimeInputSchema = z
  .object({
    issueId: positiveInt.optional(),
    projectId: positiveInt.optional(),
    hours: z.number().positive().max(24),
    spentOn: ymd.optional(),
    activityId: namedRef.optional(),
    comments: z.string().max(1024).optional(),
    ...confirmFields,
  })
  .strict()
  .refine((v) => v.issueId !== undefined || v.projectId !== undefined, {
    message: "issueId or projectId is required",
  })
  .superRefine(requirePreviewTokenWhenConfirm);

export const listTimeEntriesInputSchema = z
  .object({
    issueId: positiveInt.optional(),
    projectId: positiveInt.optional(),
    userId: z.union([z.literal("me"), positiveInt]).optional(),
    spentFrom: ymd.optional(),
    spentTo: ymd.optional(),
    activityId: namedRef.optional(),
    limit: z.number().int().positive().max(1000).optional(),
    offset: z.number().int().nonnegative().optional(),
  })
  .strict()
  .refine(
    (v) => !(v.spentFrom && v.spentTo) || v.spentFrom <= v.spentTo,
    { message: "spentFrom must not be after spentTo" }
  );

export type ConnectionInput = z.infer<typeof connectionInputSchema>;
export type ListProjectsInput = z.infer<typeof listProjectsInputSchema>;
export type SearchIssuesInput = z.infer<typeof searchIssuesInputSchema>;
export type GetIssueInput = z.infer<typeof getIssueInputSchema>;
export type SearchTextInput = z.infer<typeof searchTextInputSchema>;
export type CreateIssueInput = z.infer<typeof createIssueInputSchema>;
export type UpdateIssueInput = z.infer<typeof updateIssueInputSchema>;
export type SearchUsersInput = z.infer<typeof searchUsersInputSchema>;
export type ListProjectMembersInput = z.infer<
  typeof listProjectMembersInputSchema
>;
export type AddCommentInput = z.infer<typeof addCommentInputSchema>;
export type AddAttachmentInput = z.infer<typeof addAttachmentInputSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusInputSchema>;
export type ListMetadataInput = z.infer<typeof listMetadataInputSchema>;
export type ListIssueRelationsInput = z.infer<
  typeof listIssueRelationsInputSchema
>;
export type AddIssueRelationInput = z.infer<
  typeof addIssueRelationInputSchema
>;
export type UpdateIssueRelationInput = z.infer<
  typeof updateIssueRelationInputSchema
>;
export type RemoveIssueRelationInput = z.infer<
  typeof removeIssueRelationInputSchema
>;
export type GetAttachmentInput = z.infer<typeof getAttachmentInputSchema>;
export type BulkUpdateStatusInput = z.infer<typeof bulkUpdateStatusInputSchema>;
export type LogTimeInput = z.infer<typeof logTimeInputSchema>;
export type ListTimeEntriesInput = z.infer<typeof listTimeEntriesInputSchema>;

export function safeParseBulkUpdateStatus(input: unknown) {
  return bulkUpdateStatusInputSchema.safeParse(input ?? {});
}

export function safeParseGetAttachment(input: unknown) {
  return getAttachmentInputSchema.safeParse(input);
}

export function safeParseLogTime(input: unknown) {
  return logTimeInputSchema.safeParse(input ?? {});
}

export function safeParseListTimeEntries(input: unknown) {
  return listTimeEntriesInputSchema.safeParse(input ?? {});
}

export function safeParseConnection(input: unknown) {
  return connectionInputSchema.safeParse(input ?? {});
}

export function safeParseListProjects(input: unknown) {
  return listProjectsInputSchema.safeParse(input ?? {});
}

export function safeParseSearch(input: unknown) {
  return searchIssuesInputSchema.safeParse(input ?? {});
}

export function safeParseSearchText(input: unknown) {
  return searchTextInputSchema.safeParse(input ?? {});
}

export function safeParseGetIssue(input: unknown) {
  return getIssueInputSchema.safeParse(input);
}

export function safeParseCreateIssue(input: unknown) {
  return createIssueInputSchema.safeParse(input ?? {});
}

export function safeParseUpdateIssue(input: unknown) {
  return updateIssueInputSchema.safeParse(input ?? {});
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

export function safeParseAddAttachment(input: unknown) {
  return addAttachmentInputSchema.safeParse(input ?? {});
}

export function safeParseUpdateStatus(input: unknown) {
  return updateStatusInputSchema.safeParse(input ?? {});
}

export function safeParseListMetadata(input: unknown) {
  return listMetadataInputSchema.safeParse(input ?? {});
}

export function safeParseListIssueRelations(input: unknown) {
  return listIssueRelationsInputSchema.safeParse(input ?? {});
}

export function safeParseAddIssueRelation(input: unknown) {
  return addIssueRelationInputSchema.safeParse(input ?? {});
}

export function safeParseUpdateIssueRelation(input: unknown) {
  return updateIssueRelationInputSchema.safeParse(input ?? {});
}

export function safeParseRemoveIssueRelation(input: unknown) {
  return removeIssueRelationInputSchema.safeParse(input ?? {});
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
        description: '담당자 — "me", user id, or a name (names need projectId or the users API)',
        oneOf: [
          { type: "string" },
          { type: "integer", minimum: 1 },
        ],
      },
      authorId: {
        description: '작성자 — "me", user id, or a name',
        oneOf: [
          { type: "string" },
          { type: "integer", minimum: 1 },
        ],
      },
      watcherId: {
        description: '일감관리자(watcher) — "me", user id, or a name',
        oneOf: [
          { type: "string" },
          { type: "integer", minimum: 1 },
        ],
      },
      status: {
        description: 'open (default) | closed | all | status id | 상태 이름 ("진행중")',
        oneOf: [
          { type: "string", minLength: 1 },
          { type: "integer", minimum: 1 },
        ],
      },
      trackerId: {
        description: '유형 — id 또는 이름 ("버그")',
        oneOf: [{ type: "integer", minimum: 1 }, { type: "string", minLength: 1 }],
      },
      priorityId: {
        description: '우선순위 — id 또는 이름 ("높음")',
        oneOf: [{ type: "integer", minimum: 1 }, { type: "string", minLength: 1 }],
      },
      fixedVersionId: {
        description: '대상 버전 — id 또는 이름 (name needs projectId)',
        oneOf: [{ type: "integer", minimum: 1 }, { type: "string", minLength: 1 }],
      },
      categoryId: {
        description: "범주 — id 또는 이름 (name needs projectId)",
        oneOf: [{ type: "integer", minimum: 1 }, { type: "string", minLength: 1 }],
      },
      subjectContains: { type: "string", description: "제목에 포함된 문자열" },
      createdAfter: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "등록일 >= (YYYY-MM-DD)" },
      createdBefore: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "등록일 <= (YYYY-MM-DD)" },
      updatedAfter: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "수정일 >= (YYYY-MM-DD)" },
      updatedBefore: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "수정일 <= (YYYY-MM-DD)" },
      dueAfter: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "완료기한 >= (YYYY-MM-DD)" },
      dueBefore: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "완료기한 <= (YYYY-MM-DD) — 'this week' = dueAfter+dueBefore" },
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
  redmine_search_text: {
    type: "object",
    properties: {
      query: { type: "string", minLength: 1, description: "Words to search in subject, description, notes (and wiki/news when types say so)" },
      projectId: { type: "integer", minimum: 1, description: "Limit to one project" },
      types: {
        type: "array",
        minItems: 1,
        items: { type: "string", enum: [...SEARCH_TEXT_TYPES] },
        description: 'Default ["issues"]. Others: wiki_pages, news, documents, changesets, messages, projects',
      },
      titlesOnly: { type: "boolean", description: "Match titles only" },
      openIssuesOnly: { type: "boolean", description: "Skip closed issues" },
      allWords: { type: "boolean", description: "All words must match (default true)" },
      limit: { type: "integer", minimum: 1, maximum: 100 },
      offset: { type: "integer", minimum: 0 },
    },
    required: ["query"],
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
      parentIssueId: {
        type: "integer",
        minimum: 1,
        description:
          "상위 일감 id — set to create this issue as a 하위일감 (subtask)",
      },
      trackerId: {
        description: '유형 — tracker id 또는 이름 (예: 2, "기능추가")',
        oneOf: [
          { type: "integer", minimum: 1 },
          { type: "string", minLength: 1 },
        ],
      },
      statusId: {
        description: '상태 — status id 또는 이름 (예: 2, "진행중")',
        oneOf: [
          { type: "integer", minimum: 1 },
          { type: "string", minLength: 1 },
        ],
      },
      priorityId: {
        description: '우선순위 — priority id 또는 이름 (예: 4, "높음")',
        oneOf: [
          { type: "integer", minimum: 1 },
          { type: "string", minLength: 1 },
        ],
      },
      fixedVersionId: {
        description: '대상 버전 — version id 또는 이름 (예: "2026-Q3")',
        oneOf: [
          { type: "integer", minimum: 1 },
          { type: "string", minLength: 1 },
        ],
      },
      categoryId: {
        description: "범주 — category id 또는 이름",
        oneOf: [
          { type: "integer", minimum: 1 },
          { type: "string", minLength: 1 },
        ],
      },
      customFields: {
        description:
          '사용자 정의 필드 — [{ id 또는 name, value }]. value는 문자열, 다중 선택이면 문자열 배열, ""면 비움 (예: [{ name: "고객사", value: "A사" }])',
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            id: { type: "integer", minimum: 1 },
            name: { type: "string", minLength: 1 },
            value: {
              oneOf: [
                { type: "string" },
                { type: "array", items: { type: "string" } },
              ],
            },
          },
          required: ["value"],
          additionalProperties: false,
        },
      },
      startDate: {
        type: "string",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        description: "시작일 YYYY-MM-DD",
      },
      dueDate: {
        type: "string",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        description: "완료기한 YYYY-MM-DD",
      },
      doneRatio: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description: "진척도 0-100",
      },
      estimatedHours: { type: "number", exclusiveMinimum: 0 },
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
          '일감관리자 (Redmine watchers): array of "me", user ids, or names',
        type: "array",
        items: {
          oneOf: [
            { type: "string", const: "me" },
            { type: "integer", minimum: 1 },
            { type: "string", minLength: 1 },
          ],
        },
      },
      attachments: {
        description:
          "Local files to upload: [{ path, filename?, description? }], max 5, 10MiB each",
        type: "array",
        minItems: 1,
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            path: { type: "string", minLength: 1 },
            filename: { type: "string", minLength: 1 },
            description: { type: "string" },
          },
          required: ["path"],
          additionalProperties: false,
        },
      },
      confirm: {
        type: "boolean",
        description:
          "false/omit = dry-run (returns previewToken); true = create (requires previewToken)",
      },
      previewToken: {
        type: "string",
        minLength: 1,
        description: "Token from matching dry-run; required when confirm=true",
      },
    },
    required: ["projectId", "subject"],
    additionalProperties: false,
  },
  redmine_update_issue: {
    type: "object",
    properties: {
      issueId: { type: "integer", minimum: 1 },
      subject: { type: "string", minLength: 1 },
      description: { type: "string" },
      parentIssueId: {
        description:
          "상위 일감: id = 하위일감으로 편입/부모 변경, null = 부모 연결 해제 (하위일감 삭제). Omit to leave unchanged.",
        oneOf: [{ type: "integer", minimum: 1 }, { type: "null" }],
      },
      trackerId: {
        description: '유형 — tracker id 또는 이름 (예: 2, "기능추가")',
        oneOf: [
          { type: "integer", minimum: 1 },
          { type: "string", minLength: 1 },
        ],
      },
      statusId: {
        description: '상태 — status id 또는 이름 (예: 2, "진행중")',
        oneOf: [
          { type: "integer", minimum: 1 },
          { type: "string", minLength: 1 },
        ],
      },
      priorityId: {
        description: '우선순위 — priority id 또는 이름 (예: 4, "높음")',
        oneOf: [
          { type: "integer", minimum: 1 },
          { type: "string", minLength: 1 },
        ],
      },
      fixedVersionId: {
        description:
          '대상 버전 — id·이름, 또는 null로 비우기 (예: "2026-Q3"). Omit to leave unchanged.',
        oneOf: [
          { type: "integer", minimum: 1 },
          { type: "string", minLength: 1 },
          { type: "null" },
        ],
      },
      categoryId: {
        description:
          "범주 — id·이름, 또는 null로 비우기. Omit to leave unchanged.",
        oneOf: [
          { type: "integer", minimum: 1 },
          { type: "string", minLength: 1 },
          { type: "null" },
        ],
      },
      customFields: {
        description:
          '사용자 정의 필드 — [{ id 또는 name, value }]. value는 문자열, 다중 선택이면 문자열 배열, ""면 비움. Omit a field to leave it unchanged (예: [{ name: "고객사", value: "A사" }])',
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            id: { type: "integer", minimum: 1 },
            name: { type: "string", minLength: 1 },
            value: {
              oneOf: [
                { type: "string" },
                { type: "array", items: { type: "string" } },
              ],
            },
          },
          required: ["value"],
          additionalProperties: false,
        },
      },
      startDate: {
        type: "string",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        description: "시작일 YYYY-MM-DD",
      },
      dueDate: {
        type: "string",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        description: "완료기한 YYYY-MM-DD",
      },
      doneRatio: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description: "진척도 0-100",
      },
      estimatedHours: { type: "number", exclusiveMinimum: 0 },
      assignedTo: {
        description: '담당자: "me", user id, or name',
        oneOf: [
          { type: "string", const: "me" },
          { type: "integer", minimum: 1 },
          { type: "string", minLength: 1 },
        ],
      },
      watchers: {
        description:
          "일감관리자 replace-all when provided; omit to leave unchanged",
        type: "array",
        items: {
          oneOf: [
            { type: "string", const: "me" },
            { type: "integer", minimum: 1 },
            { type: "string", minLength: 1 },
          ],
        },
      },
      notes: {
        type: "string",
        description:
          "Optional journal note — plain text only (no Textile/Markdown). Markup is blocked.",
      },
      confirm: {
        type: "boolean",
        description:
          "false/omit = before→after preview (returns previewToken); true = apply (requires previewToken)",
      },
      previewToken: {
        type: "string",
        minLength: 1,
        description: "Token from matching dry-run; required when confirm=true",
      },
    },
    required: ["issueId"],
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
      notes: {
        type: "string",
        minLength: 1,
        description:
          "Comment body — plain text only (no Textile h3./* or Markdown). Newlines OK.",
      },
      confirm: {
        type: "boolean",
        description:
          "false/omit = dry-run (returns previewToken); true = apply (requires previewToken)",
      },
      previewToken: {
        type: "string",
        minLength: 1,
        description: "Token from matching dry-run; required when confirm=true",
      },
    },
    required: ["issueId", "notes"],
    additionalProperties: false,
  },
  redmine_add_attachment: {
    type: "object",
    properties: {
      issueId: { type: "integer", minimum: 1 },
      attachments: {
        description:
          "Local files to upload: [{ path, filename?, description? }], max 5, 10MiB each",
        type: "array",
        minItems: 1,
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            path: { type: "string", minLength: 1 },
            filename: { type: "string", minLength: 1 },
            description: { type: "string" },
          },
          required: ["path"],
          additionalProperties: false,
        },
      },
      confirm: {
        type: "boolean",
        description:
          "false/omit = dry-run preview (returns previewToken); true = upload and attach (requires previewToken)",
      },
      previewToken: {
        type: "string",
        minLength: 1,
        description: "Token from matching dry-run; required when confirm=true",
      },
    },
    required: ["issueId", "attachments"],
    additionalProperties: false,
  },
  redmine_list_metadata: {
    type: "object",
    properties: {
      projectId: {
        type: "integer",
        minimum: 1,
        description:
          "Required for versions/categories/customFields (they are per project); optional otherwise",
      },
      kinds: {
        description:
          "Defaults to trackers+statuses+priorities, plus versions+categories+customFields when projectId is given",
        type: "array",
        items: {
          type: "string",
          enum: [
            "trackers",
            "statuses",
            "priorities",
            "versions",
            "categories",
            "customFields",
            "activities",
          ],
        },
      },
    },
    additionalProperties: false,
  },
  redmine_bulk_update_status: {
    type: "object",
    properties: {
      issueIds: {
        type: "array",
        minItems: 1,
        maxItems: 50,
        items: { type: "integer", minimum: 1 },
        description: "Issues to move to the same status (1–50, no repeats)",
      },
      statusId: {
        description: '상태 — id 또는 이름 (예: 5, "완료")',
        oneOf: [
          { type: "integer", minimum: 1 },
          { type: "string", minLength: 1 },
        ],
      },
      notes: {
        type: "string",
        description: "Optional journal note added to every issue — plain text only",
      },
      confirm: {
        type: "boolean",
        description:
          "false/omit = per-issue before→after preview (returns previewToken); true = apply (requires previewToken)",
      },
      previewToken: {
        type: "string",
        minLength: 1,
        description: "Token from matching dry-run; required when confirm=true",
      },
    },
    required: ["issueIds", "statusId"],
    additionalProperties: false,
  },
  redmine_get_attachment: {
    type: "object",
    properties: {
      attachmentId: {
        type: "integer",
        minimum: 1,
        description:
          'Attachment id from redmine_get_issue include=["attachments"]',
      },
      destDir: {
        type: "string",
        minLength: 1,
        description:
          "Folder on the MCP host to save into. Default: OS temp dir under redmine-devrelay/attachments/<id>/. An existing file is not overwritten (the id is appended)",
      },
      maxBytes: {
        type: "integer",
        minimum: 1,
        maximum: ATTACHMENT_DOWNLOAD_HARD_MAX_BYTES,
        description: "Size limit. Default 10 MiB, hard max 50 MiB",
      },
      inlineText: {
        type: "boolean",
        description:
          "Return the file body as text when it looks like text (default true, first 200 KiB)",
      },
    },
    required: ["attachmentId"],
    additionalProperties: false,
  },
  redmine_log_time: {
    type: "object",
    properties: {
      issueId: {
        type: "integer",
        minimum: 1,
        description: "Issue to log time on (preferred). issueId or projectId is required",
      },
      projectId: {
        type: "integer",
        minimum: 1,
        description: "Project to log time on when there is no issue",
      },
      hours: {
        type: "number",
        exclusiveMinimum: 0,
        maximum: 24,
        description: "작업시간 (시간 단위, 예: 1.5)",
      },
      spentOn: {
        type: "string",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        description: "작업일 YYYY-MM-DD — omit for today",
      },
      activityId: {
        description: '작업 분류(활동) — id 또는 이름 (예: 9, "개발"). List with redmine_list_metadata kinds:["activities"]',
        oneOf: [
          { type: "integer", minimum: 1 },
          { type: "string", minLength: 1 },
        ],
      },
      comments: {
        type: "string",
        maxLength: 1024,
        description: "설명 — short plain text (older Redmine caps it at 255 chars)",
      },
      confirm: {
        type: "boolean",
        description:
          "false/omit = dry-run (returns previewToken); true = record (requires previewToken)",
      },
      previewToken: {
        type: "string",
        minLength: 1,
        description: "Token from matching dry-run; required when confirm=true",
      },
    },
    required: ["hours"],
    additionalProperties: false,
  },
  redmine_list_time_entries: {
    type: "object",
    properties: {
      issueId: { type: "integer", minimum: 1, description: "Time on one issue" },
      projectId: { type: "integer", minimum: 1, description: "Time on one project" },
      userId: {
        description:
          '"me" or a user id. Defaults to "me" when no issueId/projectId is given',
        oneOf: [
          { type: "string", const: "me" },
          { type: "integer", minimum: 1 },
        ],
      },
      spentFrom: {
        type: "string",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        description: "작업일 시작 YYYY-MM-DD (inclusive)",
      },
      spentTo: {
        type: "string",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        description: "작업일 끝 YYYY-MM-DD (inclusive)",
      },
      activityId: {
        description: "작업 분류(활동) — id 또는 이름",
        oneOf: [
          { type: "integer", minimum: 1 },
          { type: "string", minLength: 1 },
        ],
      },
      limit: { type: "integer", minimum: 1 },
      offset: { type: "integer", minimum: 0 },
    },
    additionalProperties: false,
  },
  redmine_list_issue_relations: {
    type: "object",
    properties: {
      issueId: {
        type: "integer",
        minimum: 1,
        description: "Issue whose 연결된 일감 (relations) to list",
      },
    },
    required: ["issueId"],
    additionalProperties: false,
  },
  redmine_add_issue_relation: {
    type: "object",
    properties: {
      issueId: { type: "integer", minimum: 1, description: "Source issue id" },
      issueToId: {
        type: "integer",
        minimum: 1,
        description: "Issue id to link to (must differ from issueId)",
      },
      relationType: {
        type: "string",
        enum: [...ISSUE_RELATION_TYPES],
        description:
          "relates(관련됨) duplicates/duplicated(중복) blocks/blocked(차단) precedes/follows(선행/후속) copied_to/copied_from(복사)",
      },
      delay: {
        type: "integer",
        description: "Days of delay — precedes/follows only",
      },
      confirm: {
        type: "boolean",
        description:
          "false/omit = dry-run (returns previewToken); true = apply (requires previewToken)",
      },
      previewToken: {
        type: "string",
        minLength: 1,
        description: "Token from matching dry-run; required when confirm=true",
      },
    },
    required: ["issueId", "issueToId", "relationType"],
    additionalProperties: false,
  },
  redmine_update_issue_relation: {
    type: "object",
    properties: {
      relationId: {
        type: "integer",
        minimum: 1,
        description: "Relation id from redmine_list_issue_relations",
      },
      issueToId: { type: "integer", minimum: 1 },
      relationType: {
        type: "string",
        enum: [...ISSUE_RELATION_TYPES],
      },
      delay: {
        description: "Days of delay (precedes/follows only); null clears it",
        oneOf: [{ type: "integer" }, { type: "null" }],
      },
      confirm: {
        type: "boolean",
        description:
          "false/omit = before→after preview (returns previewToken); true = apply (requires previewToken)",
      },
      previewToken: {
        type: "string",
        minLength: 1,
        description: "Token from matching dry-run; required when confirm=true",
      },
    },
    required: ["relationId"],
    additionalProperties: false,
  },
  redmine_remove_issue_relation: {
    type: "object",
    properties: {
      relationId: {
        type: "integer",
        minimum: 1,
        description: "Relation id from redmine_list_issue_relations",
      },
      confirm: {
        type: "boolean",
        description:
          "false/omit = dry-run (returns previewToken); true = remove (requires previewToken)",
      },
      previewToken: {
        type: "string",
        minLength: 1,
        description: "Token from matching dry-run; required when confirm=true",
      },
    },
    required: ["relationId"],
    additionalProperties: false,
  },
  redmine_update_status: {
    type: "object",
    properties: {
      issueId: { type: "integer", minimum: 1 },
      statusId: {
        description: '상태 — status id 또는 이름 (예: 2, "진행중")',
        oneOf: [
          { type: "integer", minimum: 1 },
          { type: "string", minLength: 1 },
        ],
      },
      notes: {
        type: "string",
        description:
          "Optional journal note — plain text only (no Textile/Markdown).",
      },
      confirm: {
        type: "boolean",
        description:
          "false/omit = dry-run (returns previewToken); true = apply (requires previewToken)",
      },
      previewToken: {
        type: "string",
        minLength: 1,
        description: "Token from matching dry-run; required when confirm=true",
      },
    },
    required: ["issueId", "statusId"],
    additionalProperties: false,
  },
} as const;
