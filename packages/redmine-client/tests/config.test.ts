import { describe, it, expect, afterEach } from "vitest";
import { loadConfig } from "../src/config.js";

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("loadConfig", () => {
  it("requires REDMINE_URL and REDMINE_API_KEY", () => {
    delete process.env.REDMINE_URL;
    delete process.env.REDMINE_API_KEY;
    expect(() => loadConfig()).toThrow(/REDMINE_URL|REDMINE_API_KEY/);
  });

  it("rejects non-https in production mode", () => {
    process.env.REDMINE_URL = "http://evil.example.com";
    process.env.REDMINE_API_KEY = "k";
    expect(() => loadConfig()).toThrow(/https/i);
  });

  it("allows http localhost when host is allowlisted", () => {
    process.env.REDMINE_URL = "http://localhost:3000";
    process.env.REDMINE_API_KEY = "k";
    process.env.REDMINE_ALLOWED_HOSTS = "localhost";
    const cfg = loadConfig();
    expect(cfg.baseUrl).toBe("http://localhost:3000");
  });

  it("rejects metadata IP", () => {
    process.env.REDMINE_URL = "http://169.254.169.254/";
    process.env.REDMINE_API_KEY = "k";
    process.env.REDMINE_ALLOWED_HOSTS = "169.254.169.254";
    expect(() => loadConfig()).toThrow(/metadata|link-local|forbidden/i);
  });
});
