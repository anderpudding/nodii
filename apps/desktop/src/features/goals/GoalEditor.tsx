import { useState } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { GOAL_NAME_MAX_LENGTH, isHexColor } from '@nodii/core';
import {
  useArchiveGoal,
  useCreateGoal,
  useUpdateGoal,
  type GoalContents,
  type GoalRecord,
  type NodiiClient,
} from '@nodii/api';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { notifyError } from '../../lib/notify-error';
import { GoalChip, goalStyle } from './GoalChip';
import { goalPresets } from './presets';

/** 마지막 목표 제약은 서버 경쟁 상황에서도 읽을 수 있는 문구로 알린다. */
export function notifyGoalError(error: unknown, retry: () => void) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'last_active_goal'
  ) {
    toast.error('활성 목표는 하나 이상 있어야 해요');
  } else notifyError(error, retry);
}

/** 추가와 편집을 독립된 화면으로 제공해 목록의 정보 밀도를 지킨다 (GOAL-01~03). */
export function GoalEditor({
  goal,
  client,
  initialColor,
  sortKey,
  lastActive = false,
  counts,
  onBack,
  onDelete,
}: {
  goal?: GoalRecord;
  client: NodiiClient;
  initialColor: string;
  sortKey: string;
  lastActive?: boolean;
  counts?: GoalContents;
  onBack: () => void;
  onDelete: () => void;
}) {
  const [id] = useState(() => goal?.id ?? crypto.randomUUID());
  const [name, setName] = useState(goal?.name ?? '');
  const [color, setColor] = useState(goal?.color ?? initialColor);
  const create = useCreateGoal(client, { onError: notifyGoalError });
  const update = useUpdateGoal(client, id, { onError: notifyGoalError });
  const archive = useArchiveGoal(client, id, { onError: notifyGoalError });
  const writing = useIsMutating({ mutationKey: ['write', 'goal'] }) > 0;
  const valid =
    name.trim().length > 0 && name.trim().length <= GOAL_NAME_MAX_LENGTH && isHexColor(color);
  const heading = goal ? '목표 편집' : '목표 추가';
  const preview = {
    id,
    name: name.trim() || goal?.name || '목표',
    color: isHexColor(color) ? color : goal?.color || initialColor,
    sortKey,
    archivedAt: goal?.archivedAt ?? null,
  };

  function archiveGoal() {
    if (!goal) return;
    void archive
      .mutateAsync(goal)
      .then((saved) => {
        onBack();
        toast('목표를 보관했어요', {
          duration: 5000,
          action: { label: '실행 취소', onClick: () => archive.mutate(saved) },
        });
      })
      .catch(() => {
        /* 공통 오류 처리에서 롤백과 재시도를 제공한다. */
      });
  }

  return (
    <form
      className="goal-editor-screen"
      noValidate
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229))
          event.preventDefault();
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid || writing) return;
        if (goal) {
          update.mutate({ goal, changes: { name: name.trim(), color } }, { onSuccess: onBack });
        } else {
          create.mutate(
            { id, name: name.trim(), color, sortKey, archivedAt: null },
            { onSuccess: onBack },
          );
        }
      }}
    >
      <header className="goal-editor-header">
        <h2 id="goal-editor-title">{heading}</h2>
        <Button variant="ghost" aria-label={`${heading} 닫기`} disabled={writing} onClick={onBack}>
          <span className="close-glyph" aria-hidden="true">
            ×
          </span>
        </Button>
      </header>
      <div className="sheet-body goal-editor-body">
        <div className="field-group">
          <label htmlFor={`goal-name-${id}`}>이름</label>
          <Input
            autoFocus
            id={`goal-name-${id}`}
            value={name}
            maxLength={GOAL_NAME_MAX_LENGTH}
            placeholder="예: 공부"
            disabled={writing}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <fieldset className="goal-palette" disabled={writing}>
          <legend>색상</legend>
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
        <div className="goal-color-field">
          <label htmlFor={`goal-color-${id}`}>HEX</label>
          <Input
            id={`goal-color-${id}`}
            value={color}
            maxLength={7}
            placeholder="#RRGGBB"
            disabled={writing}
            aria-invalid={!isHexColor(color)}
            aria-describedby={!isHexColor(color) ? `goal-color-error-${id}` : undefined}
            onChange={(event) => setColor(event.target.value)}
          />
        </div>
        {!isHexColor(color) && (
          <p id={`goal-color-error-${id}`} className="error-message" role="alert">
            #RRGGBB 형식으로 입력해 주세요.
          </p>
        )}
        <div className="goal-preview" aria-label="목표 미리보기">
          <GoalChip goal={preview} surface />
        </div>
        {goal && (
          <section className="goal-destructive" aria-label="목표 보관 및 삭제">
            <div>
              <strong>보관하기</strong>
              <p className="supporting">새 할 일 목록에서 숨기고, 지난 기록은 그대로 남겨요.</p>
            </div>
            <span title={lastActive ? '활성 목표는 하나 이상 있어야 해요' : undefined}>
              <Button
                variant="outline"
                disabled={writing || lastActive}
                title={lastActive ? '활성 목표는 하나 이상 있어야 해요' : undefined}
                onClick={archiveGoal}
              >
                보관
              </Button>
            </span>
            <div>
              <strong>목표 삭제</strong>
              <p className="supporting">
                {counts
                  ? `할 일 ${counts.todos}개와 루틴 ${counts.routines}개가 함께 사라져요.`
                  : '속한 할 일과 루틴이 함께 사라져요.'}
              </p>
            </div>
            <span title={lastActive ? '활성 목표는 하나 이상 있어야 해요' : undefined}>
              <Button
                variant="outline"
                className="danger-text"
                disabled={writing || lastActive}
                title={lastActive ? '활성 목표는 하나 이상 있어야 해요' : undefined}
                onClick={onDelete}
              >
                삭제
              </Button>
            </span>
          </section>
        )}
      </div>
      <div className="goal-editor-actions">
        <Button variant="ghost" disabled={writing} onClick={onBack}>
          취소
        </Button>
        <Button type="submit" disabled={!valid || writing}>
          {writing ? '저장 중…' : goal ? '저장' : '추가'}
        </Button>
      </div>
    </form>
  );
}
