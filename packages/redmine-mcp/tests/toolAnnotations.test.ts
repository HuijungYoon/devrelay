import { describe, it, expect } from "vitest";
import { TOOL_DEFS } from "../src/toolDefs.js";

describe("TOOL_DEFS annotations", () => {
  it("marks search read-only", () => {
    const t = TOOL_DEFS.find((x) => x.name === "redmine_search_issues");
    expect(t?.annotations).toEqual({
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    });
  });

  it("marks create as write open-world non-destructive", () => {
    const t = TOOL_DEFS.find((x) => x.name === "redmine_create_issue");
    expect(t?.annotations).toEqual({
      readOnlyHint: false,
      openWorldHint: true,
      destructiveHint: false,
    });
  });
});
