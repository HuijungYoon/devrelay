import type { RedmineClient } from "redmine-devrelay-client";

export async function handleListProjectMembers(
  client: RedmineClient,
  input: { projectId: number; query?: string; limit?: number }
) {
  return client.listProjectMembers(input);
}
