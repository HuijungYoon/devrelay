import { describe, it, expect } from "vitest";
import { parseByokHeaders } from "../src/http/byok.js";

describe("parseByokHeaders", () => {
  it("reads url and key", () => {
    expect(
      parseByokHeaders({
        "x-redmine-url": "https://redmine.example.com",
        "x-redmine-api-key": "abc",
      })
    ).toEqual({
      baseUrl: "https://redmine.example.com",
      apiKey: "abc",
    });
  });

  it("throws when missing", () => {
    expect(() => parseByokHeaders({})).toThrow(/X-Redmine-Url|BYOK/i);
  });
});
