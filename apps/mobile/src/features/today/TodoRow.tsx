import { t } from '@nodii/i18n';
import { useOnline } from '../../../lib/connectivity';
import { useState } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { type NodiiClient, type TodoRecord } from '@nodii/api';
import { goalTint, goalInk, type Goal, type ISODate } from '@nodii/core';
import { lightColors, useTheme } from '../../../lib/theme';
import { SwipeableRow } from '../../components/gestures/SwipeableRow';
import { actionLabel, mutationTouchesTodo, splitSwipeActions, todoActions } from './actions';
import { useTodoActions } from './useTodoActions';
import { useUIStore } from '../../stores/ui';
import { DatePickSheet } from './DatePickSheet';
import { TodoMenu } from './TodoMenu';
import { DayRowContent } from './DayRowContent';

/** TODO-02: 각 행이 독립된 요청을 가져 다른 행의 체크를 막지 않는다. */
export function TodoRow({
  todo,
  goal,
  client,
  weekStart,
  timeZone = 'UTC',
  dayLocked = false,
  isDateLocked,
}: {
  todo: TodoRecord;
  goal: Goal;
  client: NodiiClient;
  weekStart: 0 | 1;
  timeZone?: string;
  dayLocked?: boolean;
  isDateLocked?: (date: ISODate) => boolean;
}) {
  const { colors, isDark } = useTheme();
  const online = useOnline();
  const [menu, setMenu] = useState(false);
  const [picking, setPicking] = useState(false);
  const today = useUIStore((state) => state.today);
  const actions = useTodoActions(client, weekStart, todo, isDateLocked);
  const updating =
    useIsMutating({
      mutationKey: ['write'],
      predicate: (mutation) => mutationTouchesTodo(mutation.state.variables, todo.id),
    }) > 0;
  const locked = dayLocked || updating || actions.pending;
  function check() {
    if (!locked) void actions.run('toggle');
  }
  function openMenu() {
    if (!locked && !actions.locallyBusy()) setMenu(true);
  }
  const swipeActions = splitSwipeActions(
    todoActions.map(({ id, swipe }) => ({
      id,
      swipe,
      label: actionLabel(id, todo.isDone),
      visualLabel:
        id === 'toggle' ? t(todo.isDone ? 'mobile.swipe.uncomplete' : 'common.done') : undefined,
      background:
        id === 'toggle'
          ? goalTint(goal.color, colors.bg, isDark ? 0.22 : 0.14)
          : id === 'delete'
            ? lightColors.dangerFill
            : colors.chip,
      color:
        id === 'toggle'
          ? goalInk(goal.color, goalTint(goal.color, colors.bg, isDark ? 0.22 : 0.14), isDark)
          : id === 'delete'
            ? lightColors.bg
            : colors.ink,
      run: () => {
        if (!online || locked || id === 'rename') return;
        if (id === 'move') setPicking(true);
        else void actions.run(id);
      },
    })),
  );
  return (
    <>
      <SwipeableRow
        id={todo.id}
        disabled={locked || !online}
        leading={swipeActions.leading}
        trailing={swipeActions.trailing}
        onMenu={openMenu}
      >
        <DayRowContent
          title={todo.title}
          isDone={todo.isDone}
          goal={goal}
          locked={locked}
          menuTestID={`todo-menu-${todo.id}`}
          accessibilityActions={todoActions.map(({ id }) => ({
            name: id,
            label: actionLabel(id, todo.isDone),
            visualLabel:
              id === 'toggle'
                ? t(todo.isDone ? 'mobile.swipe.uncomplete' : 'common.done')
                : undefined,
          }))}
          onToggle={check}
          onMenu={openMenu}
          onAction={(name) => {
            const action = todoActions.find(({ id }) => id === name);
            if (!online || !action || locked) return;
            if (action.id === 'rename') openMenu();
            else if (action.id === 'move') setPicking(true);
            else void actions.run(action.id);
          }}
        />
      </SwipeableRow>
      {picking && (
        <DatePickSheet
          client={client}
          title={todo.title}
          date={todo.date}
          today={today}
          weekStart={weekStart}
          timeZone={timeZone}
          onClose={() => setPicking(false)}
          onSelect={(date) => void actions.run('move', date)}
        />
      )}
      {menu && (
        <TodoMenu
          todo={todo}
          goal={goal}
          locked={locked}
          onAction={(action) => {
            if (action === 'move') setPicking(true);
            else void actions.run(action);
          }}
          onSave={actions.saveTitle}
          onClose={() => setMenu(false)}
        />
      )}
    </>
  );
}
