import type { RedmineConfig } from "./config.js";
import { RedmineError } from "./errors.js";
import type { RedmineHttp } from "./http.js";
import type {
  SearchTextInput,
  SearchTextResult,
  SearchTextRow,
} from "./types.js";

type RawSearchRow = {
  id: number;
  title?: string;
  type?: string;
  url?: string;
  description?: string;
  datetime?: string;
};

type RawSearchResponse = {
  results?: RawSearchRow[];
  total_count?: number;
  offset?: number;
  limit?: number;
};

export const SEARCH_TEXT_TYPES = [
  "issues",
  "news",
  "documents",
  "changesets",
  "wiki_pages",
  "messages",
  "projects",
] as const;

export function buildSearchTextQuery(
  input: SearchTextInput
): Record<string, string | number> {
  const query: Record<string, string | number> = { q: input.query.trim() };
  const types = input.types?.length ? input.types : ["issues"];
  for (const t of types) query[t] = 1;
  if (input.titlesOnly) query.titles_only = 1;
  if (input.openIssuesOnly) query.open_issues = 1;
  if (input.allWords !== false) query.all_words = 1;
  if (input.includeAttachments) query.attachments = 1;
  return query;
}

function normalizeRow(raw: RawSearchRow): SearchTextRow {
  return {
    id: raw.id,
    title: raw.title ?? "",
    type: raw.type ?? "",
    url: raw.url ?? "",
    description: raw.description ?? "",
    datetime: raw.datetime ?? null,
  };
}

/**
 * 전문 검색 (GET /search.json, Redmine 3.3+). 프로젝트를 주면
 * /projects/:id/search.json 으로 범위를 좁힌다. 구버전 Redmine은 이 경로가 없어
 * 로그인 페이지로 튕기며 401/404가 오는데, 그건 키 문제가 아니므로 안내를 바꿔 준다.
 */
export async function searchText(
  http: RedmineHttp,
  config: RedmineConfig,
  input: SearchTextInput
): Promise<SearchTextResult> {
  const q = input.query.trim();
  if (!q) {
    throw new RedmineError({
      code: "REDMINE_VALIDATION_ERROR",
      message: "query must be non-empty",
      check: ["Pass the words to search for"],
    });
  }
  const limit = Math.min(input.limit ?? 25, config.maxResultCount, 100);
  const offset = input.offset ?? 0;
  const path =
    input.projectId !== undefined
      ? `/projects/${input.projectId}/search.json`
      : "/search.json";

  let data: RawSearchResponse;
  try {
    data = await http.getJson<RawSearchResponse>(path, {
      ...buildSearchTextQuery(input),
      limit,
      offset,
    });
  } catch (err) {
    if (
      err instanceof RedmineError &&
      (err.httpStatus === 401 || err.httpStatus === 404)
    ) {
      throw new RedmineError({
        code: "REDMINE_UNKNOWN_ERROR",
        message:
          "Full-text search is not available on this Redmine (the /search.json API needs Redmine 3.3+ and the search module)",
        httpStatus: err.httpStatus,
        retrySafe: false,
        check: [
          "Use redmine_search_issues with subjectContains instead",
          "If other calls also fail, check REDMINE_API_KEY",
        ],
      });
    }
    throw err;
  }

  const rows = (data?.results ?? []).map(normalizeRow);
  const totalCount = data?.total_count ?? rows.length;
  return {
    query: q,
    results: rows,
    totalCount,
    returnedCount: rows.length,
    hasMore: offset + rows.length < totalCount,
  };
}
