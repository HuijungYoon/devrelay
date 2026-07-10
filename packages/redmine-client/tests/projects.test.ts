import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { RedmineClient } from "../src/index.js";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.REDMINE_URL = "https://redmine.example.com";
  process.env.REDMINE_API_KEY = "k";
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.restoreAllMocks();
});

describe("projects", () => {
  it("getCurrentUser normalizes name", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: { id: 15, login: "user01", firstname: "길동", lastname: "홍" },
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = RedmineClient.fromEnv();
    const user = await client.getCurrentUser();
    expect(user).toEqual({ id: 15, login: "user01", name: "홍 길동" });
  });

  it("listProjects filters by search client-side when needed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            projects: [
              {
                id: 1,
                identifier: "cloud-hmi",
                name: "Cloud HMI",
                description: "",
                is_public: true,
                parent: null,
                status: 1,
              },
              {
                id: 2,
                identifier: "other",
                name: "Other",
                description: "",
                is_public: true,
                parent: null,
                status: 1,
              },
            ],
            total_count: 2,
            offset: 0,
            limit: 100,
          }),
          { status: 200 }
        )
      )
    );
    const client = RedmineClient.fromEnv();
    const res = await client.listProjects({ search: "Cloud", limit: 50 });
    expect(res.projects).toHaveLength(1);
    expect(res.projects[0].identifier).toBe("cloud-hmi");
  });
});
