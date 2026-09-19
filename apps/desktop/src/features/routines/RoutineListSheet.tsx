import { useState } from 'react';
import { useIsMutating } from '@tanstack/react-query';
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
  const busy = useIsMutating({ mutationKey: routineWriteKey }) > 0;
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
    <Sheet labelledBy="routine-list-title" onClose={onClose}>
      <header className="goal-sheet-header">
        <h2 id="routine-list-title">루틴 관리</h2>
        <div className="routine-actions">
          <Button
            variant="outline"
            disabled={busy || !goals.data?.some((g) => !g.archivedAt)}
            onClick={() => setEditor('new')}
          >
            새 루틴
          </Button>
          <Button variant="ghost" onClick={onClose}>
            닫기
          </Button>
        </div>
      </header>
      {goals.isError || routines.isError ? (
        <>
          <p role="alert">루틴을 불러오지 못했어요.</p>
          <Button
            variant="outline"
            onClick={() => {
              void goals.refetch();
              void routines.refetch();
            }}
          >
            다시 시도
          </Button>
        </>
      ) : !goals.data || !routines.data ? (
        <p role="status">루틴을 불러오고 있어요.</p>
      ) : (
        <>
          {!routines.data.some((r) => r.endDate === null || r.endDate >= today) && (
            <p className="supporting">
              아직 진행 중인 루틴이 없어요. 반복하고 싶은 일을 추가해 보세요.
            </p>
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
                    <GoalChip goal={goal} surface />
                    {goal.archivedAt && (
                      <p className="supporting">
                        보관한 목표예요. 보관 이후 날짜에는 나타나지 않아요.
                      </p>
                    )}
                    {rows.map((routine) => (
                      <div className="routine-list-row" key={routine.id}>
                        <div className="routine-list-copy">
                          <p className="routine-wrap">{routine.title}</p>
                          <p className="supporting">
                            {formatRoutineRule(routine, profile.weekStart)},{' '}
                            {formatCalendarDate(routine.startDate)}부터
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() => setEditor(routine)}
                          aria-label={`${routine.title} 수정`}
                        >
                          수정
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() => setEnding(routine)}
                          aria-label={`${routine.title} 그만두기`}
                        >
                          그만두기
                        </Button>
                      </div>
                    ))}
                  </section>
                )
              );
            })}
          {finished.length > 0 && (
            <section className="archived-goals">
              <h3>끝난 루틴</h3>
              <p className="supporting">기록은 캘린더에 남아 있어요.</p>
              {finished.map((routine) => (
                <div className="routine-list-row" key={routine.id}>
                  <div className="routine-list-copy">
                    <p className="routine-wrap">{routine.title}</p>
                    <p className="supporting">
                      {formatCalendarDate(routine.startDate)} ~{' '}
                      {formatCalendarDate(routine.endDate!)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setEditor(routine)}
                    aria-label={`${routine.title} 수정`}
                  >
                    수정
                  </Button>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </Sheet>
  );
}
