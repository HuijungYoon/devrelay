import type { RedmineClient } from "redmine-devrelay-client";
import type {
  AddIssueRelationInput,
  ListIssueRelationsInput,
  RemoveIssueRelationInput,
  UpdateIssueRelationInput,
} from "./schemas.js";
import { consumeIfConfirm, withIssuedToken } from "./previewStore.js";

/** 연결된 일감 목록 (read-only) */
export async function handleListIssueRelations(
  client: RedmineClient,
  input: ListIssueRelationsInput
) {
  return client.listIssueRelations(input.issueId);
}

export async function handleAddIssueRelation(
  client: RedmineClient,
  input: AddIssueRelationInput
) {
  const wouldApply = {
    issueId: input.issueId,
    issueToId: input.issueToId,
    relationType: input.relationType,
    ...(input.delay !== undefined ? { delay: input.delay } : {}),
  };

  if (!input.confirm) {
    return withIssuedToken("redmine_add_issue_relation", input, {
      dryRun: true as const,
      wouldApply,
    });
  }

  consumeIfConfirm("redmine_add_issue_relation", input);
  const relation = await client.addIssueRelation(wouldApply);
  return { dryRun: false as const, result: { relation } };
}

export async function handleUpdateIssueRelation(
  client: RedmineClient,
  input: UpdateIssueRelationInput
) {
  const current = await client.getIssueRelation(input.relationId);
  const next = {
    issueToId: input.issueToId ?? current.issueToId,
    relationType: input.relationType ?? current.relationType,
    delay: input.delay !== undefined ? input.delay : current.delay,
  };

  const changes: Array<{ field: string; from: unknown; to: unknown }> = [];
  if (next.issueToId !== current.issueToId) {
    changes.push({
      field: "issueToId",
      from: current.issueToId,
      to: next.issueToId,
    });
  }
  if (next.relationType !== current.relationType) {
    changes.push({
      field: "relationType",
      from: current.relationType,
      to: next.relationType,
    });
  }
  if (next.delay !== current.delay) {
    changes.push({ field: "delay", from: current.delay, to: next.delay });
  }

  if (!input.confirm) {
    return withIssuedToken("redmine_update_issue_relation", input, {
      dryRun: true as const,
      relationId: input.relationId,
      issueId: current.issueId,
      changes,
      note: "Redmine has no relation update API — this removes relation and re-creates it",
    });
  }

  consumeIfConfirm("redmine_update_issue_relation", input);
  const result = await client.replaceIssueRelation({
    relationId: input.relationId,
    ...(input.issueToId !== undefined ? { issueToId: input.issueToId } : {}),
    ...(input.relationType !== undefined
      ? { relationType: input.relationType }
      : {}),
    ...(input.delay !== undefined ? { delay: input.delay } : {}),
  });
  return { dryRun: false as const, result, changes };
}

export async function handleRemoveIssueRelation(
  client: RedmineClient,
  input: RemoveIssueRelationInput
) {
  const current = await client.getIssueRelation(input.relationId);
  const wouldRemove = {
    relationId: current.id,
    issueId: current.issueId,
    issueToId: current.issueToId,
    relationType: current.relationType,
    delay: current.delay,
  };

  if (!input.confirm) {
    return withIssuedToken("redmine_remove_issue_relation", input, {
      dryRun: true as const,
      wouldRemove,
      note: "Only the link is removed — both issues stay",
    });
  }

  consumeIfConfirm("redmine_remove_issue_relation", input);
  const result = await client.removeIssueRelation(input.relationId);
  return { dryRun: false as const, result: { ...result, ...wouldRemove } };
}
