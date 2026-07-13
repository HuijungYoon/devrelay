import { describe, it, expect } from "vitest";
import { formatNotesForRedmine } from "../src/textile.js";

describe("formatNotesForRedmine", () => {
  it("appends br to each line for Textile display", () => {
    const input = [
      "■ 작업 브랜치",
      "- feat/login-user-management-#23839",
      "",
      "■ 완료한 내용 (auth)",
      "",
      "1. LMS → Client 이식용 설계·계획 정리",
      "",
      "3. auth 기능·로그인 관련 페이지 이식",
      "- 로그인",
      "- 비밀번호 재설정",
    ].join("\n");

    expect(formatNotesForRedmine(input)).toBe(
      [
        "■ 작업 브랜치<br />",
        "- feat/login-user-management-#23839<br />",
        "<br />",
        "■ 완료한 내용 (auth)<br />",
        "<br />",
        "1. LMS → Client 이식용 설계·계획 정리<br />",
        "<br />",
        "3. auth 기능·로그인 관련 페이지 이식<br />",
        "- 로그인<br />",
        "- 비밀번호 재설정<br />",
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
