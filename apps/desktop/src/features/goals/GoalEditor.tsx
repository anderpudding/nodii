import { useEffect, useRef, useState } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { GOAL_NAME_MAX_LENGTH } from '@nodii/core';
import { useArchiveGoal, useUpdateGoal, type GoalRecord, type NodiiClient } from '@nodii/api';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { notifyError } from '../../lib/notify-error';
import { GoalChip, goalStyle } from './GoalChip';
import { goalPresets } from './presets';

/** 마지막 목표 제약은 서버 경쟁 상황에서도 읽을 수 있는 문구로 알린다. */
function notifyGoalError(error: unknown, retry: () => void) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'last_active_goal'
  ) {
    toast.error('활성 목표는 하나 이상 있어야 해요');
  } else notifyError(error, retry);
}
/** 이름·프리셋 색·보관만 편집하고 다음 단계의 삭제·정렬은 노출하지 않는다. */
export function GoalEditor({
  goal,
  client,
  lastActive,
}: {
  goal: GoalRecord;
  client: NodiiClient;
  lastActive: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const expand = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (!editing && wasEditing.current) expand.current?.focus();
    wasEditing.current = editing;
  }, [editing]);
  const [name, setName] = useState(goal.name);
  const [color, setColor] = useState(goal.color);
  const update = useUpdateGoal(client, goal.id, { onError: notifyGoalError });
  const archive = useArchiveGoal(client, goal.id, { onError: notifyGoalError });
  const writing = useIsMutating({ mutationKey: ['write', 'goal'] }) > 0;
  const valid = name.trim().length > 0 && name.trim().length <= GOAL_NAME_MAX_LENGTH;
  const editorId = `goal-editor-${goal.id}`;
  function changeArchive() {
    void archive
      .mutateAsync(goal)
      .then((saved) => {
        toast(goal.archivedAt ? '목표 보관을 해제했어요' : '목표를 보관했어요', {
          duration: 5000,
          action: { label: '실행 취소', onClick: () => archive.mutate(saved) },
        });
      })
      .catch(() => {
        /* 공통 onError에서 롤백과 안내를 처리한다. */
      });
  }
  return (
    <div className="goal-manager-row">
      <div className="goal-manager-summary">
        <button
          ref={expand}
          type="button"
          className="goal-expand"
          aria-label={`${goal.name} 편집`}
          aria-expanded={editing}
          aria-controls={editorId}
          disabled={writing}
          onClick={() => {
            setName(goal.name);
            setColor(goal.color);
            setEditing(!editing);
          }}
        >
          <GoalChip goal={goal} surface />
        </button>
        <span title={lastActive ? '활성 목표는 하나 이상 있어야 해요' : undefined}>
          <Button
            variant="ghost"
            disabled={writing || lastActive}
            title={lastActive ? '활성 목표는 하나 이상 있어야 해요' : undefined}
            onClick={changeArchive}
          >
            {goal.archivedAt ? '보관 해제' : '보관'}
          </Button>
        </span>
      </div>
      {editing && (
        <form
          id={editorId}
          className="goal-edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!valid || writing) return;
            update.mutate({ goal, changes: { name: name.trim(), color } });
            setEditing(false);
          }}
        >
          <label htmlFor={`goal-name-${goal.id}`}>목표 이름</label>
          <Input
            autoFocus
            id={`goal-name-${goal.id}`}
            value={name}
            maxLength={GOAL_NAME_MAX_LENGTH}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229))
                event.preventDefault();
              if (event.key === 'Escape' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                event.stopPropagation();
                setEditing(false);
              }
            }}
          />
          <fieldset className="goal-palette">
            <legend>목표 색</legend>
            {goalPresets.map((preset) => (
              <button
                type="button"
                key={preset.color}
                className="color-option"
                style={goalStyle(preset.color, true)}
                aria-label={preset.name}
                aria-pressed={color === preset.color}
                onClick={() => setColor(preset.color)}
              >
                {color === preset.color ? (
                  <svg viewBox="0 0 22 22" aria-hidden="true">
                    <path d="m5 11 4 4 8-8" />
                  </svg>
                ) : null}
              </button>
            ))}
          </fieldset>
          <GoalChip goal={{ ...goal, name: name.trim() || goal.name, color }} surface />
          <div className="goal-edit-actions">
            <Button variant="ghost" onClick={() => setEditing(false)}>
              취소
            </Button>
            <Button type="submit" disabled={!valid || writing}>
              저장
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
