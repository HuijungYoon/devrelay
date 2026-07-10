import type { RedmineClient } from "redmine-client";

export async function handleTestConnection(client: RedmineClient) {
  const user = await client.getCurrentUser();
  return {
    connected: true,
    redmineUrl: client.config.baseUrl,
    user,
  };
}
