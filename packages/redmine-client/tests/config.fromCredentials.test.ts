import { describe, it, expect } from "vitest";
import { configFromCredentials, RedmineClient } from "../src/index.js";

describe("configFromCredentials", () => {
  it("builds config from url + apiKey without process env", () => {
    const config = configFromCredentials({
      baseUrl: "https://redmine.example.com",
      apiKey: "secret-key",
    });
    expect(config.baseUrl).toBe("https://redmine.example.com");
    expect(config.apiKey).toBe("secret-key");
    expect(() => RedmineClient.fromConfig(config)).not.toThrow();
  });

  it("rejects missing apiKey", () => {
    expect(() =>
      configFromCredentials({ baseUrl: "https://redmine.example.com", apiKey: "  " })
    ).toThrow(/API_KEY|apiKey/i);
  });

  it("rejects non-https public hosts", () => {
    expect(() =>
      configFromCredentials({
        baseUrl: "http://redmine.example.com",
        apiKey: "k",
      })
    ).toThrow(/https/i);
  });
});
