import type { RedmineClient } from "redmine-devrelay-client";
import type { ListProjectsInput } from "./schemas.js";

export async function handleListProjects(
  client: RedmineClient,
  input: ListProjectsInput
) {
  return client.listProjects(input);
}
