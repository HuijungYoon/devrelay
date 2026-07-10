import { describe, it, expect, vi } from "vitest";
import { handleGetIssue, handleSearchIssues } from "../src/tools/issues.js";

describe("issue handlers", () => {
  it("searchIssues delegates to client", async () => {
    const searchIssues = vi.fn().mockResolvedValue({
      issues: [],
      totalCount: 0,
      returnedCount: 0,
      hasMore: false,
    });
    const client = { searchIssues };
    await handleSearchIssues(client as never, {
      assignedTo: "me",
      status: "open",
    });
    expect(searchIssues).toHaveBeenCalledWith({
      assignedTo: "me",
      status: "open",
    });
  });

  it("getIssue passes include journals", async () => {
    const getIssue = vi.fn().mockResolvedValue({ id: 1, subject: "x" });
    const client = { getIssue };
    await handleGetIssue(client as never, {
      issueId: 1523,
      include: ["journals"],
    });
    expect(getIssue).toHaveBeenCalledWith(1523, { include: ["journals"] });
  });
});
