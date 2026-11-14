import { VisibilityContext } from '../social/VisibilityContext';
import { GoalMark } from './GoalMark';
import { GoalColorPicker } from './GoalColorPicker';
import { showPublishNotice } from './publish-notice';
import { t } from '@nodii/i18n';
import { useContext, useState } from 'react';
import { useIsMutating, useQuery } from '@tanstack/react-query';
import {
  checkColor,
  GOAL_NAME_MAX_LENGTH,
  isHexColor,
  VISIBILITY_CHOICES,
  type DefaultVisibility,
} from '@nodii/core';
import {
  fetchProfile,
  useArchiveGoal,
  useCreateGoal,
  useGoalVisibility,
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
  userId,
  initialColor,
  sortKey,
  lastActive = false,
  counts,
  onBack,
  onDelete,
}: {
  goal?: GoalRecord;
  client: NodiiClient;
  userId: string;
  initialColor: string;
  sortKey: string;
  lastActive?: boolean;
  counts?: GoalContents;
  onBack: () => void;
  onDelete: () => void;
}) {
  const social = useContext(VisibilityContext);
  const account = useQuery({
    queryKey: ['profile', userId],
    enabled: social && !goal,
    queryFn: ({ signal }) => fetchProfile(client, userId, signal),
    staleTime: 30_000,
  });
  const [changedVisibility, setVisibility] = useState<DefaultVisibility>();
  const visibility =
    changedVisibility ?? goal?.visibility ?? account.data?.defaultVisibility ?? 'private';
  const [pickerOpen, setPickerOpen] = useState(false);
  const [validHexDraft, setValidHexDraft] = useState(true);
  const [id] = useState(() => goal?.id ?? crypto.randomUUID());
  const [name, setName] = useState(goal?.name ?? '');
  const [color, setColor] = useState(goal?.color ?? initialColor);
  const create = useCreateGoal(client, { onError: notifyGoalError }, userId);
  const update = useGoalVisibility(client, id, { onError: notifyGoalError });
  const archive = useArchiveGoal(client, id, { onError: notifyGoalError });
  const writing = useIsMutating({ mutationKey: ['write', 'goal'] }) > 0;
  const custom = !goalPresets.some((preset) => preset.color === color);
  const valid =
    (!pickerOpen || validHexDraft) &&
    (!social || !!goal || !!account.data) &&
    name.trim().length > 0 &&
    name.trim().length <= GOAL_NAME_MAX_LENGTH &&
    isHexColor(color);
  const heading = goal ? t('goal.edit') : t('goal.add');
  const preview = {
    id,
    name: name.trim() || goal?.name || t('routine.goal'),
    color: isHexColor(color) ? color : goal?.color || initialColor,
    sortKey,
    archivedAt: goal?.archivedAt ?? null,
    visibility,
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
          update.mutate(
            {
              goal,
              changes: {
                name: name.trim(),
                color,
                visibility: social ? changedVisibility : undefined,
              },
            },
            { onSuccess: onBack },
          );
        } else {
          create.mutate(
            {
              id,
              name: name.trim(),
              color,
              sortKey,
              archivedAt: null,
              visibility: social ? visibility : undefined,
            },
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
              onClick={() => {
                setColor(preset.color);
                setPickerOpen(false);
                setValidHexDraft(true);
              }}
            >
              {color === preset.color ? (
                <svg viewBox="0 0 22 22" aria-hidden="true">
                  <path d="m5 11 4 4 8-8" />
                </svg>
              ) : null}
            </button>
          ))}
          {social && (
            <button
              type="button"
              className="color-option goal-rainbow"
              aria-label={t('goal.colorPicker.open')}
              aria-expanded={pickerOpen}
              onClick={() => {
                setPickerOpen(!pickerOpen);
                setValidHexDraft(true);
              }}
            >
              {custom && (
                <span
                  className="goal-custom-color"
                  style={{ backgroundColor: color, color: checkColor(color) }}
                >
                  ✓
                </span>
              )}
            </button>
          )}
        </fieldset>
        {social && pickerOpen && (
          <GoalColorPicker color={color} onChange={setColor} onValidityChange={setValidHexDraft} />
        )}
        {!social && (
          <>
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
          </>
        )}
        {social && (
          <fieldset className="goal-vis" disabled={writing || (!goal && !account.data)}>
            <legend>{t('social.visibility.label')}</legend>
            <div className="goal-vis-choices">
              {VISIBILITY_CHOICES.map((choice) => (
                <button
                  type="button"
                  key={choice}
                  aria-pressed={visibility === choice}
                  onClick={() => {
                    showPublishNotice(visibility, choice);
                    setVisibility(choice);
                  }}
                >
                  <GoalMark
                    color={preview.color}
                    visibility={choice}
                    selected={visibility === choice}
                  />
                  {t(`social.visibility.${choice}`)}
                </button>
              ))}
            </div>
            {visibility !== 'public' && (
              <p className="supporting">{t(`social.visibility.${visibility}Help`)}</p>
            )}
          </fieldset>
        )}
        {social && !goal && account.isError && (
          <Button variant="outline" onClick={() => void account.refetch()}>
            {t('common.tryAgain')}
          </Button>
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
          {t('mobile.add.cancel')}
        </Button>
        <Button type="submit" disabled={!valid || writing}>
          {writing ? t('common.saving') : goal ? t('mobile.rename.save') : t('mobile.add.action')}
        </Button>
      </div>
    </form>
  );
}
