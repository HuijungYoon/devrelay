---
name: Creating an issue asks for 일감관리자 and never confirms alone
tags: [write-gate, create-issue]
plugins: ["../.."]
runs: 2
max_turns: 8
allowed_tools: [mcp__redmine__redmine_list_projects, mcp__redmine__redmine_list_project_members, mcp__redmine__redmine_create_issue, mcp__redmine__redmine_list_metadata]
---
CLOUD-HMI 프로젝트에 "로그인 화면 비밀번호 마스킹 오류" 일감 하나 만들어줘. 설명은 "비밀번호 입력 시 마지막 글자가 잠깐 보임" 으로.
