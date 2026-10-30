import { t } from '@nodii/i18n';
import { useOnline } from '../../../lib/connectivity';
import { useState } from 'react';
import type { NodiiClient } from '@nodii/api';
import {
  goalInk,
  goalTint,
  type Goal,
  type ISODate,
  type Routine,
  type RoutineLog,
} from '@nodii/core';
import { lightColors, useTheme } from '../../../lib/theme';
import { SwipeableRow } from '../../components/gestures/SwipeableRow';
import { DayRowContent } from '../today/DayRowContent';
import {
  routineActions,
  routineActionLabel,
  splitSwipeActions,
  type RoutineAction,
} from '../today/actions';
import { RoutineMenu } from './RoutineMenu';
import { useRoutineActions } from './useRoutineActions';

/** ROUT-05~07: 공용 행 모양을 쓰되 완료·건너뛰기·편집·종료는 루틴 경로로 보낸다. */
export function RoutineRow({
  routine,
  log,
  goal,
  date,
  client,
  weekStart,
  onEdit,
  onStop,
}: {
  routine: Routine;
  log: RoutineLog | null;
  goal: Goal;
  date: ISODate;
  client: NodiiClient;
  weekStart: 0 | 1;
  onEdit(): void;
  onStop(): void;
}) {
  const { colors, isDark } = useTheme();
  const online = useOnline();
  const [menu, setMenu] = useState(false);
  const actions = useRoutineActions(client, weekStart, routine, date);
  const done = log?.status === 'done';
  function run(id: RoutineAction) {
    if (!online || actions.pending || actions.locallyBusy()) return;
    if (id === 'edit') onEdit();
    else if (id === 'stop') onStop();
    else void actions.run(id);
  }
  function openMenu() {
    if (!actions.pending && !actions.locallyBusy()) setMenu(true);
  }
  const swipe = splitSwipeActions(
    routineActions.map(({ id, swipe }) => ({
      id,
      swipe,
      label: routineActionLabel(id, done),
      visualLabel:
        id === 'toggle' ? t(done ? 'mobile.swipe.uncomplete' : 'common.done') : undefined,
      background:
        id === 'toggle'
          ? goalTint(goal.color, colors.bg, isDark ? 0.22 : 0.14)
          : id === 'stop'
            ? lightColors.dangerFill
            : colors.chip,
      color:
        id === 'toggle'
          ? goalInk(goal.color, goalTint(goal.color, colors.bg, isDark ? 0.22 : 0.14), isDark)
          : id === 'stop'
            ? lightColors.bg
            : colors.ink,
      run: () => run(id),
    })),
  );
  return (
    <>
      <SwipeableRow
        id={routine.id}
        disabled={!online || actions.pending}
        leading={swipe.leading}
        trailing={swipe.trailing}
        onMenu={openMenu}
      >
        <DayRowContent
          title={routine.title}
          isDone={done}
          goal={goal}
          locked={actions.pending}
          menuTestID={`routine-menu-${routine.id}`}
          onToggle={() => run('toggle')}
          onMenu={openMenu}
          accessibilityActions={routineActions.map(({ id }) => ({
            name: id,
            label: routineActionLabel(id, done),
          }))}
          onAction={(name) => {
            const action = routineActions.find(({ id }) => id === name);
            if (action) run(action.id);
          }}
        />
      </SwipeableRow>
      {menu && (
        <RoutineMenu
          routine={routine}
          goal={goal}
          isDone={done}
          locked={actions.pending}
          onClose={() => setMenu(false)}
          onAction={run}
        />
      )}
    </>
  );
}
