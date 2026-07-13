---
name: create-issue
description: Create a Redmine issue after dry-run confirmation
---

# Create Redmine issue

1. Resolve `projectId`: if user gave a name, call `redmine_list_projects` and pick best match (ask if ambiguous). Never create without projectId.
2. Call `redmine_create_issue` with `confirm` omitted/false. Show `wouldApply` to the user.
3. Only after explicit user approval, call again with `confirm: true`.
4. Never print API keys. Do not set confirm=true on the first call.
