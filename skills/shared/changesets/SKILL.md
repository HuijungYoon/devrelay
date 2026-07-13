---
name: changesets
description: Changesets versioning and changelog workflow for LicenseAuthSystem. Trigger when adding a changeset, bumping versions, writing release notes, or preparing a PR that affects delivered behavior (feat/fix in Client or Server).
---

# Changesets Skill

Use this skill for **version bumps** and **CHANGELOG** management in the LicenseAuthSystem monorepo.

## When to Use

| Situation | Action |
|-----------|--------|
| PR adds/fixes user-visible behavior (`feat`, `fix`) | Add a changeset before opening PR |
| Docs-only, chore, refactor (no release impact) | Changeset **not** required |
| User asks "changeset 추가", "버전 올려", "릴리즈 노트" | Follow this skill |

Pair with `skills/shared/git-commit-command/SKILL.md` for branch/commit message rules.

## Project Setup (already configured)

- Package manager: **pnpm** (Node **22.18.0**, Volta pin)
- Config: `.changeset/config.json` (`baseBranch`: `develop`)
- Root scripts in `package.json`:
  - `pnpm changeset` — create a new changeset file
  - `pnpm version` — apply changesets, bump versions, update CHANGELOG
  - `pnpm release` — publish (private monorepo; use when npm publish is needed)

## Standard PR Flow (feature / bugfix)

1. Implement changes on a feature branch from `develop`.
2. Run tests/lint in the affected package (`Client/` or `Server/`).
3. **Add a changeset:**

   ```bash
   pnpm changeset
   ```

4. Answer the prompts:
   - **Which packages?** Select affected package(s) when `Client` / `Server` have their own `package.json`. Until then, select the root package.
   - **Bump type:**
     - `patch` — backward-compatible bug fix
     - `minor` — backward-compatible new feature
     - `major` — breaking change
   - **Summary** — short Korean or English line for CHANGELOG (release-note style).

5. Commit **code + `.changeset/*.md`** together:

   ```bash
   git add .
   git commit -m "feat(client) : 라이선스 활성화 API 연동"
   ```

   The changeset file can be in the same commit or a follow-up `chore(repo) : changeset 추가` — prefer **same PR, before merge**.

6. Open PR into `develop`. Reviewers see the changeset file and know the release impact.

## After Merge to develop (release maintainer)

When ready to cut a release on `develop`:

```bash
git checkout develop
git pull origin develop
pnpm version
```

This consumes `.changeset/*.md` files, bumps `package.json` version(s), and writes **CHANGELOG.md**.

Then commit the version bump:

```bash
git add .
git commit -m "chore(repo) : version bump"
```

## Bump Type Guide

| Type | Use when |
|------|----------|
| `patch` | Bug fix, no API/behavior contract break |
| `minor` | New feature, backward compatible |
| `major` | Breaking API, schema, or client contract change |

## Monorepo (Client + Server)

When `Client/package.json` and `Server/package.json` exist:

1. Add `pnpm-workspace.yaml` at repo root:

   ```yaml
   packages:
     - 'Client'
     - 'Server'
   ```

2. Update `.changeset/config.json` if packages need to version together (`fixed` / `linked` arrays).

3. Run `pnpm changeset` and select **client**, **server**, or both.

## Examples

### Client feature

```bash
pnpm changeset
# → select client package, minor
# → "라이선스 활성화 화면 및 API 연동"

git add Client/ .changeset/
git commit -m "feat(client) : 라이선스 활성화 화면 추가"
```

### Server-only fix

```bash
pnpm changeset
# → select server package, patch
# → "만료된 라이선스 검증 시 403 반환 오류 수정"

git add Server/ .changeset/
git commit -m "fix(server) : 만료 라이선스 검증 오류 수정"
```

### No changeset needed

- `docs(repo) : README 수정`
- `chore(repo) : CI 설정`
- `refactor(server) : 내부 모듈 구조 정리 (동작 동일)`

## Rules for AI Agents

- Do **not** run `pnpm version` on a feature branch unless the user explicitly asks.
- Do **not** delete existing `.changeset/*.md` files created by teammates.
- Prefer **one changeset per logical PR**; split only if one PR contains unrelated releasable units.
- Summaries should be clear enough for CHANGELOG — no internal ticket jargon only.
- If `pnpm changeset` fails (no workspace packages), check whether `Client/` / `Server/` `package.json` exists and `pnpm-workspace.yaml` is configured.

## Reference

- [Changesets docs](https://github.com/changesets/changesets)
- Config: `.changeset/config.json`
- Git workflow: `skills/shared/git-commit-command/SKILL.md`
