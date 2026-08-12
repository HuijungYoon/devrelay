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

  it("marks relation reads read-only and relation writes as writes", () => {
    const list = TOOL_DEFS.find(
      (x) => x.name === "redmine_list_issue_relations"
    );
    expect(list?.annotations?.readOnlyHint).toBe(true);
    for (const name of [
      "redmine_add_issue_relation",
      "redmine_update_issue_relation",
      "redmine_remove_issue_relation",
    ]) {
      const t = TOOL_DEFS.find((x) => x.name === name);
      expect(t, name).toBeTruthy();
      expect(t?.annotations?.readOnlyHint, name).toBe(false);
    }
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
