import { describe, it, expect, afterEach } from "vitest";
import { RedmineClient, RedmineError, loadConfig } from "../../src/index.js";

const enabled = process.env.REDMINE_INTEGRATION === "1";

describe.runIf(enabled)("redmine integration", () => {
  const originalKey = process.env.REDMINE_API_KEY;

  afterEach(() => {
    process.env.REDMINE_API_KEY = originalKey;
  });

  it("authenticates", async () => {
    const client = RedmineClient.fromEnv();
    const user = await client.getCurrentUser();
    expect(user.id).toBeGreaterThan(0);
    expect(user.login.length).toBeGreaterThan(0);
  });

  it("rejects bad key", async () => {
    process.env.REDMINE_API_KEY = "definitely-invalid-key";
    // rebuild config/client with bad key
    expect(() => loadConfig()).not.toThrow();
    const client = RedmineClient.fromEnv();
    await expect(client.getCurrentUser()).rejects.toMatchObject({
      code: "REDMINE_AUTHENTICATION_ERROR",
    });
  });

  it("searches my open issues", async () => {
    const client = RedmineClient.fromEnv();
    const res = await client.searchIssues({
      assignedTo: "me",
      status: "open",
      limit: 10,
    });
    expect(res.returnedCount).toBeLessThanOrEqual(10);
    expect(res.totalCount).toBeGreaterThanOrEqual(0);
  });

  it("gets issue with journals when an issue exists", async () => {
    const client = RedmineClient.fromEnv();
    const list = await client.searchIssues({ status: "open", limit: 1 });
    if (list.issues.length === 0) {
      return;
    }
    const detail = await client.getIssue(list.issues[0].id, {
      include: ["journals"],
    });
    expect(detail.id).toBe(list.issues[0].id);
    expect(Array.isArray(detail.journals)).toBe(true);
  });
});

describe.runIf(!enabled)("redmine integration (skipped without env)", () => {
  it("documents how to enable", () => {
    expect(RedmineError).toBeDefined();
  });
});
