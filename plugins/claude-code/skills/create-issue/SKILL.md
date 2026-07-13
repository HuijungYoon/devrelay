---
name: create-issue
description: Create a Redmine issue after dry-run confirmation
---

# Create Redmine issue

**프로젝트부터 확정한다.** `projectId` 없이 dry-run/생성으로 가지 않는다.

1. **프로젝트 (필수, 최우선)**
   - 사용자가 프로젝트 id·이름·식별자를 아직 안 줬으면: `redmine_list_projects`로 목록을 보여 주고 **어느 프로젝트인지 먼저 물어본다.** 답이 오기 전에 subject만으로 `redmine_create_issue`를 호출하지 않는다.
   - 이름/식별자만 있으면: `redmine_list_projects`로 매칭. 모호하면 후보를 보여 주고 고르게 한다.
   - 숫자 id가 확실하면 그대로 사용.
2. **subject** (필수)와 description 등 옵션을 모은다.
3. **일감 담당자 (`assignedTo`)** — 지정 여부를 묻는다.
   - 본인: `assignedTo: "me"`
   - 이름(예: 윤석준): 그대로 문자열로 전달 가능 (서버가 user id로 해석). 모호하면 `redmine_search_users`로 id 확인.
   - 숫자 user id / 미지정(생략)도 가능.
   - 이미 담당자를 말했으면 다시 묻지 않고 매핑한다.
4. `redmine_create_issue`를 `confirm` 생략/`false`로 호출하고 `wouldApply`(프로젝트·제목·담당자 포함)를 보여 준다.
5. 사용자가 명시한 뒤에만 `confirm: true`로 다시 호출한다.
6. API Key를 출력하지 않는다. 첫 호출에 `confirm=true`를 쓰지 않는다.
