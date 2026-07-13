import { describe, it, expect } from "vitest";
import {
  formatDescriptionForRedmine,
  formatNotesForRedmine,
} from "../src/textile.js";

describe("formatNotesForRedmine", () => {
  it("appends br to each line for display", () => {
    const input = [
      "■ 작업 브랜치",
      "- feat/login-user-management-#23839",
      "",
      "■ 완료한 내용 (auth)",
    ].join("\n");

    expect(formatNotesForRedmine(input)).toBe(
      [
        "■ 작업 브랜치<br />",
        "- feat/login-user-management-#23839<br />",
        "<br />",
        "■ 완료한 내용 (auth)<br />",
      ].join("\n")
    );
  });

  it("does not double-append br", () => {
    expect(formatNotesForRedmine("hello<br />\nworld<br>")).toBe(
      "hello<br />\nworld<br>"
    );
  });

  it("normalizes CRLF", () => {
    expect(formatNotesForRedmine("a\r\nb\rc")).toBe("a<br />\nb<br />\nc<br />");
  });
});

describe("formatDescriptionForRedmine", () => {
  it("wraps plain-text lines in p tags", () => {
    const input = [
      "관련일감: #23840",
      "",
      "현상",
      "- 첫 번째 줄",
      "- 두 번째 줄",
      "",
      "원인",
      "- 디코딩 누락",
    ].join("\n");

    expect(formatDescriptionForRedmine(input)).toBe(
      [
        "<p>관련일감: #23840</p>",
        "<p>현상</p>",
        "<p>- 첫 번째 줄</p>",
        "<p>- 두 번째 줄</p>",
        "<p>원인</p>",
        "<p>- 디코딩 누락</p>",
      ].join("\n")
    );
  });

  it("leaves existing HTML unchanged", () => {
    const html =
      "<p>관련일감: #23840</p>\n<p><strong>현상</strong></p>\n<p>- item</p>";
    expect(formatDescriptionForRedmine(html)).toBe(html);
  });

  it("escapes plain-text special characters", () => {
    expect(formatDescriptionForRedmine('a < b & "c"')).toBe(
      "<p>a &lt; b &amp; &quot;c&quot;</p>"
    );
  });
});
