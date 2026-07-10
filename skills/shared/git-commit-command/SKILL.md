---
name: git-commit-command
description: Git commit messages, branch names, and PR workflow for LicenseAuthSystem. Trigger when the user asks for a commit command, commit message, branch naming, PR-ready Git workflow, hotfix flow, or cross-branch local integration testing.
---

# Git Commit Command Skill

Use this skill for Git authoring and PR workflow in the **LicenseAuthSystem** monorepo (`Client/`, `Server/`, `skills/`, root docs).

## Instructions

1. Follow the branch strategy.

   - `production`: deployment branch; do not recommend direct push.
   - `develop`: default integration branch for completed work.
   - `feat/...`, `fix/...`, `refactor/...`, `docs/...`, `chore/...`, and `hotfix/...` are temporary working branches.

2. Write branch names with this pattern:

   - `type/short-description-#issue`
   - Examples:
     - `feat/license-activation-api-#23811`
     - `fix/client-login-error-#23812`
     - `chore/ai-agents-structure-#23811`
     - `docs/agents-md-setup-#23813`
     - `hotfix/validation-bypass-#23814`

3. Write commit messages with this pattern:

   - `tag(scope) : description`
   - Prefer concise Korean descriptions unless the user asks for English.
   - **Client-only work:** changes only under `Client/` → scope **`client`**
   - **Server-only work:** changes only under `Server/` → scope **`server`**
   - **Root / shared work:** `skills/`, `docs/`, `AGENTS.md`, `.cursor/` → scope **`repo`** or the dominant area
   - **Mixed Client + Server:** split commits when possible; otherwise use the dominant scope and note the other area in the description
   - Examples:
     - `feat(client) : 라이선스 활성화 화면 추가`
     - `fix(server) : 만료된 라이선스 검증 오류 수정`
     - `chore(repo) : AI 에이전트용 AGENTS.md 구조 추가`
     - `docs(repo) : README 및 스킬 문서 정리`

4. Choose the commit tag by intent, not by file type.

   - `feat`: user-visible feature addition
   - `fix`: defect correction
   - `refactor`: internal restructuring without behavior change
   - `docs`: documentation-only change
   - `chore`: tooling, configuration, dependency, or project structure work
   - `hotfix`: urgent production issue correction

5. Recommend a safe default Git flow for normal feature work.

   - Create a branch from `develop`.
   - Make changes and validate them (`pnpm test`, `pnpm lint` in `Client/` or `Server/` as applicable).
   - For **feat/fix** that affects released behavior, add a changeset (`pnpm changeset`) — see `skills/shared/changesets/SKILL.md`.
   - Commit code and `.changeset/*.md` together when a changeset was added.
   - Open a PR into `develop`.

6. Changesets workflow — read `skills/shared/changesets/SKILL.md` for full detail.

   - `patch`: backward-compatible bug fix
   - `minor`: backward-compatible feature
   - `major`: breaking change
   - Docs-only or internal-only work: changeset not required unless the user asks.

7. Check the real workspace scripts before suggesting runnable commands.

   - This monorepo uses **`pnpm`** at the repo root.
   - Available scripts: `pnpm changeset`, `pnpm version`, `pnpm release`

8. Prefer command examples that match the actual workflow intent.

   - Feature branch creation:
     ```bash
     git checkout develop
     git pull origin develop
     git checkout -b feat/short-description-#1234
     ```
   - Standard commit (Client example):
     ```bash
     git add Client/
     git commit -m "feat(client) : 기능 설명"
     ```
   - Standard commit with changeset:
     ```bash
     pnpm changeset
     git add Client/ .changeset/
     git commit -m "feat(client) : 기능 설명"
     ```
   - Standard commit (repo-wide example):
     ```bash
     git add AGENTS.md skills/ .cursor/
     git commit -m "chore(repo) : AI 에이전트 구조 추가"
     ```

9. For production emergencies, recommend the hotfix sync rule explicitly.

   - Start from `production`.
   - Fix on `hotfix/...-#issue`.
   - Merge back to both `production` and `develop`.

9. For cross-branch integration testing (e.g. Client + Server teammate branches), keep the workflow local-only.

   - Save local work first with commit or stash.
   - Fetch the teammate branch.
   - Temporarily merge the remote branch locally.
   - After testing, return to the pre-merge state with:
     ```bash
     git reset --hard ORIG_HEAD
     ```
   - Never recommend pushing the temporary merged state.

10. When the user asks for a final commit command, return the smallest complete answer:

    - branch name if needed
    - exact `git add` and `git commit -m ...` command

11. Keep recommendations aligned with this product context.

    - LicenseAuthSystem: license activation, validation, and session management.
    - Prefer small, reviewable, reversible changes.
    - Never commit secrets (`.env`, API keys, credentials).
    - Avoid risky Git history rewrites unless the user explicitly asks for them.
