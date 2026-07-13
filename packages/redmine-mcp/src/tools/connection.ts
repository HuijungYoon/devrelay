import type { RedmineClient } from "redmine-devrelay-client";

export async function handleTestConnection(client: RedmineClient) {
  const user = await client.getCurrentUser();
  return {
    connected: true,
    redmineUrl: client.config.baseUrl,
    user,
  };
}
