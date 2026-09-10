import type { RedmineClient } from "redmine-devrelay-client";
import type { SearchTextInput } from "./schemas.js";

/** 전문 검색 (본문·댓글·위키). 읽기 도구. 구버전 Redmine은 클라이언트가 안내 에러를 낸다 */
export async function handleSearchText(
  client: RedmineClient,
  input: SearchTextInput
) {
  return client.searchText({
    query: input.query,
    ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
    ...(input.types !== undefined ? { types: input.types } : {}),
    ...(input.titlesOnly !== undefined ? { titlesOnly: input.titlesOnly } : {}),
    ...(input.openIssuesOnly !== undefined
      ? { openIssuesOnly: input.openIssuesOnly }
      : {}),
    ...(input.allWords !== undefined ? { allWords: input.allWords } : {}),
    ...(input.limit !== undefined ? { limit: input.limit } : {}),
    ...(input.offset !== undefined ? { offset: input.offset } : {}),
  });
}
