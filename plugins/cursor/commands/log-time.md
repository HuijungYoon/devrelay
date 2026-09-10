---
description: Redmine 작업시간 기록·조회 (issueId·hours·활동, dry-run 후 확인)
---

Use the **log-time** skill. To record: parse issue id, hours, spentOn (omit for today), activity (ask once if not given), dry-run with `redmine_log_time`, then confirm=true only after user OK. To list: `redmine_list_time_entries` with spentFrom/spentTo (defaults to my entries).
