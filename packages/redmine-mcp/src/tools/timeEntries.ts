import type { RedmineClient } from "redmine-devrelay-client";
import type { ListTimeEntriesInput, LogTimeInput } from "./schemas.js";
import { consumeIfConfirm, withIssuedToken } from "./previewStore.js";
import { resolveNamedRef } from "./metadata.js";

/** 오늘 날짜 (서버 로컬 시간) — Redmine도 spent_on을 생략하면 오늘로 잡는다 */
export function todayYmd(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function resolveActivity(
  client: RedmineClient,
  value: number | string | undefined
): Promise<{ id: number; label?: string } | undefined> {
  if (value === undefined) return undefined;
  return resolveNamedRef(client, "activities", value, "activityId");
}

/**
 * 작업시간 기록. dry-run은 대상 일감을 실제로 읽어 제목을 보여 주고(존재 확인 겸),
 * spentOn을 생략했으면 오늘 날짜를 미리보기에 박아 준다.
 */
export async function handleLogTime(client: RedmineClient, input: LogTimeInput) {
  const activity = await resolveActivity(client, input.activityId);

  let issueSubject: string | undefined;
  let projectId = input.projectId;
  if (input.issueId !== undefined) {
    const issue = await client.getIssue(input.issueId);
    issueSubject = issue.subject;
    projectId = issue.project?.id ?? projectId;
  }

  const spentOn = input.spentOn ?? todayYmd();
  const wouldApply = {
    ...(input.issueId !== undefined ? { issueId: input.issueId } : {}),
    ...(issueSubject !== undefined ? { issueSubject } : {}),
    ...(projectId !== undefined ? { projectId } : {}),
    hours: input.hours,
    spentOn,
    ...(activity
      ? {
          activityId: activity.id,
          ...(activity.label ? { activityLabel: activity.label } : {}),
        }
      : {}),
    ...(input.comments !== undefined ? { comments: input.comments } : {}),
    user: "me",
  };

  if (!input.confirm) {
    return withIssuedToken("redmine_log_time", input, {
      dryRun: true as const,
      wouldApply,
    });
  }

  consumeIfConfirm("redmine_log_time", input);
  const result = await client.createTimeEntry({
    ...(input.issueId !== undefined
      ? { issueId: input.issueId }
      : { projectId: input.projectId as number }),
    hours: input.hours,
    spentOn,
    ...(activity ? { activityId: activity.id } : {}),
    ...(input.comments !== undefined ? { comments: input.comments } : {}),
  });
  return { dryRun: false as const, result };
}

/**
 * 작업시간 조회. 일감·프로젝트·사용자 중 아무것도 없으면 "내 기록"으로 본다.
 * 활동은 id 또는 이름.
 */
export async function handleListTimeEntries(
  client: RedmineClient,
  input: ListTimeEntriesInput
) {
  const activity = await resolveActivity(client, input.activityId);
  const userId =
    input.userId ??
    (input.issueId === undefined && input.projectId === undefined
      ? ("me" as const)
      : undefined);

  const result = await client.listTimeEntries({
    ...(input.issueId !== undefined ? { issueId: input.issueId } : {}),
    ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
    ...(userId !== undefined ? { userId } : {}),
    ...(input.spentFrom !== undefined ? { spentFrom: input.spentFrom } : {}),
    ...(input.spentTo !== undefined ? { spentTo: input.spentTo } : {}),
    ...(activity ? { activityId: activity.id } : {}),
    ...(input.limit !== undefined ? { limit: input.limit } : {}),
    ...(input.offset !== undefined ? { offset: input.offset } : {}),
  });

  return {
    ...(userId !== undefined ? { userId } : {}),
    ...(activity?.label ? { activityLabel: activity.label } : {}),
    ...result,
  };
}
