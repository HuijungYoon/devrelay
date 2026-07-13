import { describe, it, expect } from "vitest";
import {
  safeParseAddComment,
  safeParseConnection,
  safeParseCreateIssue,
  safeParseGetIssue,
  safeParseSearch,
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

  it("addComment requires notes", () => {
    expect(safeParseAddComment({ issueId: 1 }).success).toBe(false);
    expect(
      safeParseAddComment({ issueId: 1, notes: "n", confirm: true }).success
    ).toBe(true);
  });

  it("updateStatus requires statusId", () => {
    expect(safeParseUpdateStatus({ issueId: 1 }).success).toBe(false);
    expect(
      safeParseUpdateStatus({ issueId: 1, statusId: 4 }).success
    ).toBe(true);
  });
});
