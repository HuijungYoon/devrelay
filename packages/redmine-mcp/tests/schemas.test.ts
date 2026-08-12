import { describe, it, expect } from "vitest";
import {
  safeParseAddAttachment,
  safeParseAddComment,
  safeParseAddIssueRelation,
  safeParseConnection,
  safeParseCreateIssue,
  safeParseGetIssue,
  safeParseListIssueRelations,
  safeParseListMetadata,
  safeParseRemoveIssueRelation,
  safeParseSearch,
  safeParseUpdateIssue,
  safeParseUpdateIssueRelation,
  safeParseUpdateStatus,
} from "../src/tools/schemas.js";

describe("tool schemas", () => {
  it("rejects unknown properties on search", () => {
    expect(safeParseSearch({ limit: 10, hack: true }).success).toBe(false);
  });

  it("accepts empty connection args", () => {
    expect(safeParseConnection({}).success).toBe(true);
  });

  it("requires positive issueId", () => {
    expect(safeParseGetIssue({ issueId: -1 }).success).toBe(false);
  });

  it("accepts getIssue with journals include", () => {
    expect(
      safeParseGetIssue({ issueId: 1523, include: ["journals"] }).success
    ).toBe(true);
  });

  it("createIssue requires projectId and subject", () => {
    expect(safeParseCreateIssue({}).success).toBe(false);
    expect(
      safeParseCreateIssue({ projectId: 1, subject: "x" }).success
    ).toBe(true);
  });

  it("createIssue accepts assignedTo name string", () => {
    expect(
      safeParseCreateIssue({
        projectId: 1,
        subject: "x",
        assignedTo: "윤석준",
      }).success
    ).toBe(true);
  });

  it("createIssue accepts watchers array for 일감관리자", () => {
    expect(
      safeParseCreateIssue({
        projectId: 1,
        subject: "x",
        assignedTo: "me",
        watchers: ["윤석준", 12],
      }).success
    ).toBe(true);
  });

  it("createIssue accepts richer preview fields", () => {
    expect(
      safeParseCreateIssue({
        projectId: 1,
        subject: "x",
        statusId: 1,
        startDate: "2026-07-13",
        doneRatio: 10,
      }).success
    ).toBe(true);
  });

  it("updateIssue requires a mutable field", () => {
    expect(safeParseUpdateIssue({ issueId: 1 }).success).toBe(false);
    expect(
      safeParseUpdateIssue({ issueId: 1, doneRatio: 20 }).success
    ).toBe(true);
  });

  it("addComment requires notes", () => {
    expect(safeParseAddComment({ issueId: 1 }).success).toBe(false);
    expect(
      safeParseAddComment({ issueId: 1, notes: "n" }).success
    ).toBe(true);
  });

  it("confirm=true requires previewToken", () => {
    expect(
      safeParseAddComment({ issueId: 1, notes: "n", confirm: true }).success
    ).toBe(false);
    expect(
      safeParseAddComment({
        issueId: 1,
        notes: "n",
        confirm: true,
        previewToken: "tok",
      }).success
    ).toBe(true);
  });

  it("updateStatus requires statusId", () => {
    expect(safeParseUpdateStatus({ issueId: 1 }).success).toBe(false);
    expect(
      safeParseUpdateStatus({ issueId: 1, statusId: 4 }).success
    ).toBe(true);
  });

  it("createIssue accepts attachments", () => {
    expect(
      safeParseCreateIssue({
        projectId: 1,
        subject: "S",
        attachments: [{ path: "C:/tmp/a.png", filename: "a.png" }],
      }).success
    ).toBe(true);
  });

  it("addAttachment requires attachments", () => {
    expect(safeParseAddAttachment({ issueId: 1 }).success).toBe(false);
    expect(
      safeParseAddAttachment({
        issueId: 1,
        attachments: [{ path: "./a.txt" }],
      }).success
    ).toBe(true);
  });

  it("createIssue accepts parentIssueId for a subtask", () => {
    expect(
      safeParseCreateIssue({ projectId: 1, subject: "S", parentIssueId: 40 })
        .success
    ).toBe(true);
    expect(
      safeParseCreateIssue({ projectId: 1, subject: "S", parentIssueId: null })
        .success
    ).toBe(false);
  });

  it("updateIssue accepts parentIssueId number and null on its own", () => {
    expect(safeParseUpdateIssue({ issueId: 44, parentIssueId: 41 }).success).toBe(
      true
    );
    expect(
      safeParseUpdateIssue({ issueId: 44, parentIssueId: null }).success
    ).toBe(true);
  });

  it("listIssueRelations requires issueId only", () => {
    expect(safeParseListIssueRelations({ issueId: 100 }).success).toBe(true);
    expect(safeParseListIssueRelations({}).success).toBe(false);
  });

  it("addIssueRelation validates relationType and self-links", () => {
    expect(
      safeParseAddIssueRelation({
        issueId: 100,
        issueToId: 200,
        relationType: "relates",
      }).success
    ).toBe(true);
    expect(
      safeParseAddIssueRelation({
        issueId: 100,
        issueToId: 200,
        relationType: "nope",
      }).success
    ).toBe(false);
    expect(
      safeParseAddIssueRelation({
        issueId: 100,
        issueToId: 100,
        relationType: "relates",
      }).success
    ).toBe(false);
  });

  it("addIssueRelation requires previewToken when confirm=true", () => {
    expect(
      safeParseAddIssueRelation({
        issueId: 100,
        issueToId: 200,
        relationType: "relates",
        confirm: true,
      }).success
    ).toBe(false);
  });

  it("updateIssueRelation needs at least one changed field", () => {
    expect(safeParseUpdateIssueRelation({ relationId: 7 }).success).toBe(false);
    expect(
      safeParseUpdateIssueRelation({ relationId: 7, delay: null }).success
    ).toBe(true);
  });

  it("removeIssueRelation takes a relationId", () => {
    expect(safeParseRemoveIssueRelation({ relationId: 7 }).success).toBe(true);
    expect(safeParseRemoveIssueRelation({ issueId: 7 }).success).toBe(false);
  });

  it("createIssue accepts a status name as well as an id", () => {
    expect(
      safeParseCreateIssue({ projectId: 1, subject: "S", statusId: 2 }).success
    ).toBe(true);
    expect(
      safeParseCreateIssue({ projectId: 1, subject: "S", statusId: "\uc9c4\ud589\uc911" })
        .success
    ).toBe(true);
    expect(
      safeParseCreateIssue({ projectId: 1, subject: "S", statusId: "" }).success
    ).toBe(false);
  });

  it("createIssue accepts fixedVersionId and categoryId by name", () => {
    expect(
      safeParseCreateIssue({
        projectId: 1,
        subject: "S",
        fixedVersionId: "2026-Q3",
        categoryId: 2,
      }).success
    ).toBe(true);
  });

  it("updateIssue takes fixedVersionId null to clear it, on its own", () => {
    expect(
      safeParseUpdateIssue({ issueId: 5, fixedVersionId: null }).success
    ).toBe(true);
    expect(safeParseUpdateIssue({ issueId: 5, categoryId: null }).success).toBe(
      true
    );
  });

  it("updateStatus accepts a status name", () => {
    expect(safeParseUpdateStatus({ issueId: 5, statusId: "\uc644\ub8cc" }).success).toBe(
      true
    );
  });

  it("listMetadata needs projectId for versions/categories", () => {
    expect(safeParseListMetadata({}).success).toBe(true);
    expect(safeParseListMetadata({ kinds: ["statuses"] }).success).toBe(true);
    expect(safeParseListMetadata({ kinds: ["versions"] }).success).toBe(false);
    expect(
      safeParseListMetadata({ kinds: ["versions"], projectId: 11 }).success
    ).toBe(true);
    expect(safeParseListMetadata({ kinds: ["nope"] }).success).toBe(false);
  });
});
