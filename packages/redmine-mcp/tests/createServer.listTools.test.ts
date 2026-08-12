import { describe, it, expect } from "vitest";
import { RedmineClient, configFromCredentials } from "redmine-devrelay-client";
import { createRedmineMcpServer } from "../src/createServer.js";
import { listToolsPayload } from "../src/toolDefs.js";

describe("createRedmineMcpServer listTools", () => {
  it("listTools includes annotations", () => {
    const client = RedmineClient.fromConfig(
      configFromCredentials({
        baseUrl: "https://redmine.example.com",
        apiKey: "k",
      })
    );
    // Ensure factory accepts a config-built client (transport-free).
    const server = createRedmineMcpServer(client);
    expect(server).toBeTruthy();

    // Prefer pure helper over Server.request (needs connected transport).
    const result = listToolsPayload();
    const create = result.tools.find((t) => t.name === "redmine_create_issue");
    expect(create?.annotations?.readOnlyHint).toBe(false);
    expect(create?.annotations).toEqual({
      readOnlyHint: false,
      openWorldHint: true,
      destructiveHint: false,
    });
  });
});
