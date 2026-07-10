import { describe, it, expect } from "vitest";
import { maskSecret } from "../src/mask.js";

describe("maskSecret", () => {
  it("replaces api key substrings", () => {
    const key = "abcd1234efgh5678";
    expect(maskSecret(`key=${key}`, key)).toBe("key=***");
  });

  it("returns original when secret empty", () => {
    expect(maskSecret("hello", "")).toBe("hello");
  });
});
