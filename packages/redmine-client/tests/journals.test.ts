import { describe, it, expect, vi } from "vitest";
import { RedmineClient } from "../src/client.js";
import type { RedmineHttp } from "../src/http.js";
import type { RedmineConfig } from "../src/config.js";

const config: RedmineConfig = {
  baseUrl: "https://redmine.example.com",
  apiKey: "k",
  connectTimeoutMs: 5000,
  requestTimeoutMs: 15000,
  maxResultCount: 100,
  logLevel: "info",
  userAgent: "redmine-mcp/0.8.0",
};

describe("issue journals", () => {
  it("keeps field-change details next to the note", async () => {
    const getJson = vi.fn().mockResolvedValue({
      issue: {
        id: 7,
        subject: "S",
        journals: [
          {
            id: 1,
            user: { id: 164, name: "윤 희중" },
            notes: "완료했습니다",
            created_on: "2026-09-09T03:13:41Z",
            details: [
              { property: "attr", name: "status_id", old_value: "2", new_value: "5" },
              { property: "attr", name: "done_ratio", old_value: "70", new_value: "100" },
            ],
          },
          { id: 2, notes: "", created_on: "2026-09-10T01:00:00Z" },
        ],
      },
    });
    const client = new RedmineClient({ getJson } as unknown as RedmineHttp, config);
    const issue = await client.getIssue(7, { include: ["journals"] });
    expect(issue.journals?.[0].details).toEqual([
      { property: "attr", name: "status_id", oldValue: "2", newValue: "5" },
      { property: "attr", name: "done_ratio", oldValue: "70", newValue: "100" },
    ]);
    expect(issue.journals?.[1]).toMatchObject({ notes: "", details: [] });
  });
});
