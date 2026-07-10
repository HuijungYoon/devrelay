import { describe, it, expect } from "vitest";
import {
  safeParseConnection,
  safeParseGetIssue,
  safeParseSearch,
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
});
