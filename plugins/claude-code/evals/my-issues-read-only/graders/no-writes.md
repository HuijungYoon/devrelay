---
type: regex
target: trace
pattern: "redmine_(create_issue|update_issue|add_comment|add_attachment|update_status|bulk_update_status|log_time|add_issue_relation|update_issue_relation|remove_issue_relation)"
match: not_contains
---
A read-only request must not call any write tool.
