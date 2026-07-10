import { describe, it, expect, vi } from "vitest";
import { handleTestConnection } from "../src/tools/connection.js";

describe("handleTestConnection", () => {
  it("returns connected user without api key", async () => {
    const client = {
      getCurrentUser: vi.fn().mockResolvedValue({
        id: 1,
        login: "u",
        name: "User",
      }),
      config: { baseUrl: "https://redmine.example.com", apiKey: "SECRET" },
    };
    const result = await handleTestConnection(client as never);
    expect(result.connected).toBe(true);
    expect(result.user.login).toBe("u");
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });
});
