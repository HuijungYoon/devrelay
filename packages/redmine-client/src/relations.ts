import { RedmineError } from "./errors.js";
import type { RedmineHttp } from "./http.js";
import type {
  AddIssueRelationInput,
  IssueRelation,
  ListIssueRelationsResult,
  RemoveIssueRelationResult,
  ReplaceIssueRelationInput,
  ReplaceIssueRelationResult,
} from "./types.js";
import { DELAY_RELATION_TYPES, ISSUE_RELATION_TYPES } from "./types.js";

type RawRelation = {
  id: number;
  issue_id: number;
  issue_to_id: number;
  relation_type: string;
  delay?: number | null;
};

type RawRelationsResponse = {
  relations?: RawRelation[];
  total_count?: number;
};

function normalizeRelation(raw: RawRelation): IssueRelation {
  return {
    id: raw.id,
    issueId: raw.issue_id,
    issueToId: raw.issue_to_id,
    relationType: raw.relation_type,
    delay: raw.delay ?? null,
  };
}

function assertRelationType(relationType: string): void {
  if ((ISSUE_RELATION_TYPES as readonly string[]).includes(relationType)) {
    return;
  }
  throw new RedmineError({
    code: "REDMINE_VALIDATION_ERROR",
    message: `Unknown relationType "${relationType}"`,
    check: [`Use one of: ${ISSUE_RELATION_TYPES.join(", ")}`],
  });
}

function assertDelayAllowed(
  relationType: string,
  delay: number | null | undefined
): void {
  if (delay === undefined || delay === null) return;
  if ((DELAY_RELATION_TYPES as readonly string[]).includes(relationType)) {
    return;
  }
  throw new RedmineError({
    code: "REDMINE_VALIDATION_ERROR",
    message: `delay is only valid for ${DELAY_RELATION_TYPES.join("/")} relations, not "${relationType}"`,
    check: [
      "Drop delay for this relation type",
      "Or use relationType precedes/follows",
    ],
  });
}

export async function listIssueRelations(
  http: RedmineHttp,
  issueId: number
): Promise<ListIssueRelationsResult> {
  const data = await http.getJson<RawRelationsResponse>(
    `/issues/${issueId}/relations.json`
  );
  const relations = (data?.relations ?? []).map(normalizeRelation);
  return {
    issueId,
    relations,
    totalCount: data?.total_count ?? relations.length,
  };
}

export async function getIssueRelation(
  http: RedmineHttp,
  relationId: number
): Promise<IssueRelation> {
  const data = await http.getJson<{ relation?: RawRelation }>(
    `/relations/${relationId}.json`
  );
  if (!data?.relation) {
    throw new RedmineError({
      code: "REDMINE_ISSUE_NOT_FOUND",
      message: `Relation #${relationId} was not found`,
      check: [
        "List relations with redmine_list_issue_relations to get a valid id",
      ],
      retrySafe: false,
    });
  }
  return normalizeRelation(data.relation);
}

export async function addIssueRelation(
  http: RedmineHttp,
  input: AddIssueRelationInput
): Promise<IssueRelation> {
  assertRelationType(input.relationType);
  assertDelayAllowed(input.relationType, input.delay);
  if (input.issueId === input.issueToId) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: "An issue cannot be related to itself",
      check: ["Pass a different issueToId"],
    });
  }

  const relation: Record<string, unknown> = {
    issue_to_id: input.issueToId,
    relation_type: input.relationType,
  };
  if (input.delay !== undefined && input.delay !== null) {
    relation.delay = input.delay;
  }

  const data = await http.postJson<{ relation?: RawRelation }>(
    `/issues/${input.issueId}/relations.json`,
    { relation }
  );
  if (!data?.relation) {
    throw new Error("Redmine addIssueRelation returned empty body");
  }
  return normalizeRelation(data.relation);
}

export async function removeIssueRelation(
  http: RedmineHttp,
  relationId: number
): Promise<RemoveIssueRelationResult> {
  await http.deleteJson(`/relations/${relationId}.json`);
  return { relationId, removed: true };
}

/**
 * Redmine has no relation update endpoint, so a change is delete + re-create.
 * The original relation is read first so unchanged fields carry over.
 */
export async function replaceIssueRelation(
  http: RedmineHttp,
  input: ReplaceIssueRelationInput
): Promise<ReplaceIssueRelationResult> {
  const existing = await getIssueRelation(http, input.relationId);
  const relationType = input.relationType ?? existing.relationType;
  assertRelationType(relationType);
  const delay =
    input.delay !== undefined ? input.delay : existing.delay;
  assertDelayAllowed(relationType, delay);

  const next: AddIssueRelationInput = {
    issueId: existing.issueId,
    issueToId: input.issueToId ?? existing.issueToId,
    relationType: relationType as AddIssueRelationInput["relationType"],
    delay,
  };

  await removeIssueRelation(http, input.relationId);

  try {
    const relation = await addIssueRelation(http, next);
    return { removedRelationId: input.relationId, relation };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new RedmineError({
      code: "REDMINE_UNKNOWN_ERROR",
      message: `Relation #${input.relationId} was removed but the replacement failed: ${reason}`,
      check: [
        `Re-add it with redmine_add_issue_relation: issueId=${next.issueId}, issueToId=${next.issueToId}, relationType=${next.relationType}`,
        "Check the issue #" + next.issueId + " relations panel in Redmine",
      ],
      retrySafe: false,
    });
  }
}
