import { t } from '@nodii/i18n';
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
    toast.error(t('goal.lastActive.required'));
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
  const heading = goal ? t('goal.edit') : t('goal.add');
  const preview = {
    id,
    name: name.trim() || goal?.name || t('goal.label'),
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
        toast(t('goal.archived.summary'), {
          duration: 5000,
          action: { label: t('todo.undo'), onClick: () => archive.mutate(saved) },
        });
      })
      .catch(() => {
        /* 공통 오류 처리에서 롤백과 재시도를 제공한다. */
      });
  }

  return (
    <form
      className={`goal-editor-screen ${goal ? 'goal-edit-screen' : 'goal-add-screen'}`}
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
        <Button
          variant="ghost"
          aria-label={t('common.closeNamed', { name: heading })}
          disabled={writing}
          onClick={onBack}
        >
          <span className="close-glyph" aria-hidden="true">
            ×
          </span>
        </Button>
      </header>
      <div className="sheet-body goal-editor-body">
        <div className="field-group">
          <label htmlFor={`goal-name-${id}`}>{t('common.name')}</label>
          <Input
            autoFocus
            id={`goal-name-${id}`}
            value={name}
            maxLength={GOAL_NAME_MAX_LENGTH}
            placeholder={t('goal.name.placeholder')}
            disabled={writing}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <fieldset className="goal-palette" disabled={writing}>
          <legend>{t('common.color')}</legend>
          {goalPresets.map((preset) => (
            <button
              type="button"
              key={preset.color}
              className="color-option"
              style={goalStyle(preset.color, true)}
              aria-label={t(preset.nameKey)}
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
            {t('goal.hex.error')}
          </p>
        )}
        <div className="goal-preview" aria-label={t('goal.preview.label')}>
          <GoalChip goal={preview} />
        </div>
        {goal && (
          <section className="goal-destructive" aria-label={t('goal.destructive')}>
            <div>
              <strong>{t('goal.archive.action')}</strong>
              <p className="supporting">{t('goal.archive.help')}</p>
            </div>
            <span title={lastActive ? t('goal.lastActive.required') : undefined}>
              <Button
                variant="outline"
                disabled={writing || lastActive}
                title={lastActive ? t('goal.lastActive.required') : undefined}
                onClick={archiveGoal}
              >
                {t('goal.archive')}
              </Button>
            </span>
            <div>
              <strong>{t('goal.delete')}</strong>
              <p className="supporting">
                {counts
                  ? t('goal.delete.contents', { todos: counts.todos, routines: counts.routines })
                  : t('goal.delete.contentsUnknown')}
              </p>
            </div>
            <span title={lastActive ? t('goal.lastActive.required') : undefined}>
              <Button
                variant="outline"
                className="danger-text"
                disabled={writing || lastActive}
                title={lastActive ? t('goal.lastActive.required') : undefined}
                onClick={onDelete}
              >
                {t('todo.action.delete')}
              </Button>
            </span>
          </section>
        )}
      </div>
      <div className="goal-editor-actions">
        <Button variant="ghost" disabled={writing} onClick={onBack}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={!valid || writing}>
          {writing ? t('common.saving') : goal ? t('common.save') : t('common.add')}
        </Button>
      </div>
    </form>
  );
}
