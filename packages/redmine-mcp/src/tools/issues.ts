import type { RedmineClient } from "redmine-devrelay-client";
import type { GetIssueInput, SearchIssuesInput } from "./schemas.js";

export async function handleSearchIssues(
  client: RedmineClient,
  input: SearchIssuesInput
) {
  return client.searchIssues(input);
}

export async function handleGetIssue(
  client: RedmineClient,
  input: GetIssueInput
) {
  return client.getIssue(input.issueId, { include: input.include });
}
