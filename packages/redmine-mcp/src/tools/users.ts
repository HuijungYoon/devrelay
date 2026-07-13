import type { RedmineClient } from "redmine-devrelay-client";

export async function handleSearchUsers(
  client: RedmineClient,
  input: { query?: string; limit?: number }
) {
  return client.searchUsers(input);
}
