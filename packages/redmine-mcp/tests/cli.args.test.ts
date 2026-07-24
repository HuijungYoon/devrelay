import { describe, it, expect } from "vitest";
import { parseCliArgs } from "../src/cli.js";

describe("parseCliArgs", () => {
  it("defaults to stdio", () => {
    expect(parseCliArgs(["node", "index.js"])).toEqual({ mode: "stdio" });
  });

  it("parses --http and --port", () => {
    expect(parseCliArgs(["node", "index.js", "--http", "--port", "9090"])).toEqual({
      mode: "http",
      port: 9090,
    });
  });
});
