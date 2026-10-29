import { t } from '@nodii/i18n';
import { useState } from 'react';
import { useIsMutating, useMutationState } from '@tanstack/react-query';
import { compareSortKey, type Profile } from '@nodii/core';
import {
  routineWriteKey,
  useGoals,
  useRoutines,
  type NodiiClient,
  type RoutineRecord,
} from '@nodii/api';
import { Sheet } from '../../components/ui/sheet';
import { Button } from '../../components/ui/button';
import { useUIStore } from '../../stores/ui';
import { GoalChip } from '../goals/GoalChip';
import { formatCalendarDate } from '../calendar/CalendarGrid';
import { formatRoutineRule } from './format-rule';
import { RoutineEditor } from './RoutineEditor';
import { RoutineStopDialog } from './RoutineStopDialog';

/** 현재 루틴을 목표별로 모으고 끝난 루틴의 과거 기록도 찾아갈 수 있게 한다 (ROUT-10). */
export function RoutineListSheet({
  client,
  profile,
  onClose,
}: {
  client: NodiiClient;
  profile: Profile;
  onClose: () => void;
}) {
  const today = useUIStore((s) => s.today);
  const goals = useGoals(client);
  const routines = useRoutines(client);
  const [editor, setEditor] = useState<RoutineRecord | 'new' | null>(null);
  const [ending, setEnding] = useState<RoutineRecord | null>(null);
  const busy = useIsMutating({ mutationKey: routineWriteKey, exact: true }) > 0;
  const pendingIds = useMutationState({
    filters: {
      status: 'pending',
      predicate: (mutation) => {
        const key = mutation.options.mutationKey;
        return key?.[0] === 'write' && (key[1] === 'routine' || key[1] === 'routineLog');
      },
    },
    select: (mutation) => mutation.options.mutationKey?.[2],
  });
  const finished = (routines.data ?? []).filter((r) => r.endDate !== null && r.endDate < today);
  if (editor)
    return (
      <RoutineEditor
        client={client}
        profile={profile}
        routine={editor === 'new' ? undefined : editor}
        onClose={() => setEditor(null)}
      />
    );
  if (ending)
    return <RoutineStopDialog routine={ending} client={client} onClose={() => setEnding(null)} />;
  return (
    <Sheet
      labelledBy="routine-list-title"
      onClose={onClose}
      className="scroll-sheet routine-list-sheet"
    >
      <header className="routine-list-header">
        <h2 id="routine-list-title">{t('routine.manage')}</h2>
        <div className="routine-list-actions">
          <Button
            variant="outline"
            disabled={busy || !goals.data?.some((g) => !g.archivedAt)}
            onClick={() => setEditor('new')}
          >
            <span aria-hidden="true">＋</span> {t('routine.new')}
          </Button>
          <Button onClick={onClose}>{t('common.done')}</Button>
        </div>
      </header>
      <div className="sheet-body routine-list-body">
        {goals.isError || routines.isError ? (
          <>
            <p role="alert">{t('routine.failed')}</p>
            <Button
              variant="outline"
              onClick={() => {
                void goals.refetch();
                void routines.refetch();
              }}
            >
              {t('common.tryAgain')}
            </Button>
          </>
        ) : !goals.data || !routines.data ? (
          <p role="status">{t('routine.loading')}</p>
        ) : (
          <>
            {!routines.data.some((r) => r.endDate === null || r.endDate >= today) && (
              <p className="supporting routine-list-empty">{t('routine.empty')}</p>
            )}
            {[...goals.data]
              .sort((a, b) => compareSortKey(a.sortKey, b.sortKey))
              .map((goal) => {
                const rows = routines.data
                  .filter((r) => r.goalId === goal.id && (r.endDate === null || r.endDate >= today))
                  .sort((a, b) => compareSortKey(a.sortKey, b.sortKey));
                return (
                  rows.length > 0 && (
                    <section className="routine-list-group" key={goal.id} aria-label={goal.name}>
                      <GoalChip goal={goal} />
                      {goal.archivedAt && (
                        <p className="supporting">{t('routine.goal.archived')}</p>
                      )}
                      <div className="routine-group-rows">
                        {rows.map((routine) => (
                          <div className="routine-list-row" key={routine.id}>
                            <div className="routine-list-copy">
                              <strong className="routine-wrap">{routine.title}</strong>
                              <p className="supporting">
                                {t('routine.list.summary', {
                                  rule: formatRoutineRule(routine, profile.weekStart),
                                  date: formatCalendarDate(routine.startDate),
                                })}
                              </p>
                            </div>
                            <div className="routine-row-actions">
                              <Button
                                variant="ghost"
                                disabled={busy || pendingIds.includes(routine.id)}
                                onClick={() => setEditor(routine)}
                                aria-label={t('common.editNamed', { name: routine.title })}
                              >
                                {t('menu.edit')}
                              </Button>
                              <Button
                                variant="ghost"
                                disabled={busy || pendingIds.includes(routine.id)}
                                onClick={() => setEnding(routine)}
                                aria-label={t('routine.stop.label', { title: routine.title })}
                              >
                                {t('routine.stop')}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )
                );
              })}
            {finished.length > 0 && (
              <section className="routine-finished">
                <div className="routine-finished-heading">
                  <h3>{t('routine.ended.title')}</h3>
                  <p className="supporting">{t('routine.recordsRemain.help')}</p>
                </div>
                <div className="routine-group-rows">
                  {finished.map((routine) => (
                    <div className="routine-list-row routine-list-row-finished" key={routine.id}>
                      <div className="routine-list-copy">
                        <strong className="routine-wrap">{routine.title}</strong>
                        <p className="supporting">
                          {formatCalendarDate(routine.startDate)} ~{' '}
                          {formatCalendarDate(routine.endDate!)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
