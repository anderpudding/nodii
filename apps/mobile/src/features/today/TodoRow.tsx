import { useState } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type NodiiClient, type TodoRecord } from '@nodii/api';
import { checkColor, goalTint, goalInk, type Goal, type ISODate } from '@nodii/core';
import { t } from '@nodii/i18n';
import { lightColors, metrics as m, useTheme } from '../../../lib/theme';
import { SwipeableRow } from '../../components/gestures/SwipeableRow';
import { actionLabel, mutationTouchesTodo, splitSwipeActions, todoActions } from './actions';
import { useTodoActions } from './useTodoActions';
import { useUIStore } from '../../stores/ui';
import { DatePickSheet } from './DatePickSheet';
import { TodoMenu } from './TodoMenu';

/** TODO-02: 각 행이 독립된 요청을 가져 다른 행의 체크를 막지 않는다. */
export function TodoRow({
  todo,
  goal,
  client,
  weekStart,
  dayLocked = false,
  isDateLocked,
}: {
  todo: TodoRecord;
  goal: Goal;
  client: NodiiClient;
  weekStart: 0 | 1;
  dayLocked?: boolean;
  isDateLocked?: (date: ISODate) => boolean;
}) {
  const { colors, isDark } = useTheme();
  const [menu, setMenu] = useState(false);
  const [picking, setPicking] = useState(false);
  const today = useUIStore((state) => state.today);
  const actions = useTodoActions(client, weekStart, todo, isDateLocked);
  const [focused, setFocused] = useState(false);
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
      background:
        id === 'toggle'
          ? goalTint(goal.color, colors.bg, isDark ? 0.22 : 0.14)
          : id === 'delete'
            ? lightColors.danger
            : colors.side,
      color:
        id === 'toggle'
          ? goalInk(goal.color, colors.bg, isDark)
          : id === 'delete'
            ? lightColors.bg
            : colors.ink,
      run: () => {
        if (locked || id === 'rename') return;
        if (id === 'move') setPicking(true);
        else void actions.run(id);
      },
    })),
  );
  return (
    <>
      <SwipeableRow
        id={todo.id}
        disabled={locked}
        leading={swipeActions.leading}
        trailing={swipeActions.trailing}
        onMenu={openMenu}
      >
        <View style={styles.row}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={t(todo.isDone ? 'todo.uncomplete' : 'todo.complete', {
              title: todo.title,
            })}
            accessibilityState={{
              checked: todo.isDone,
              disabled: locked,
              busy: locked,
            }}
            disabled={locked}
            onPress={check}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={({ pressed }) => [
              styles.touch,
              {
                opacity: pressed ? m.pressedOpacity : 1,
                borderColor: focused ? colors.focus : colors.bg,
              },
            ]}
          >
            <View
              style={[
                styles.box,
                {
                  backgroundColor: todo.isDone ? goal.color : colors.boxFill,
                  borderColor: todo.isDone ? goal.color : colors.field,
                },
              ]}
            >
              {todo.isDone && (
                <Text accessible={false} style={[styles.check, { color: checkColor(goal.color) }]}>
                  ✓
                </Text>
              )}
            </View>
          </Pressable>
          <Pressable
            testID={`todo-menu-${todo.id}`}
            accessibilityRole="button"
            accessibilityLabel={t('mobile.menu.open', { title: todo.title })}
            accessibilityState={{ disabled: locked, busy: locked }}
            accessibilityActions={todoActions.map(({ id }) => ({
              name: id,
              label: actionLabel(id, todo.isDone),
            }))}
            onAccessibilityAction={(event) => {
              const action = todoActions.find(({ id }) => id === event.nativeEvent.actionName);
              if (!action || locked) return;
              if (action.id === 'rename') openMenu();
              else if (action.id === 'move') setPicking(true);
              else void actions.run(action.id);
            }}
            disabled={locked}
            onPress={openMenu}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={({ pressed }) => [
              styles.titleTouch,
              {
                opacity: pressed ? m.pressedOpacity : 1,
                borderColor: focused ? colors.focus : colors.bg,
              },
            ]}
          >
            <Text
              style={[
                styles.title,
                {
                  color: todo.isDone ? colors.muted : colors.ink,
                  textDecorationLine: todo.isDone ? 'line-through' : 'none',
                },
              ]}
            >
              {todo.title}
            </Text>
          </Pressable>
        </View>
      </SwipeableRow>
      {picking && (
        <DatePickSheet
          client={client}
          title={todo.title}
          date={todo.date}
          today={today}
          weekStart={weekStart}
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
const styles = StyleSheet.create({
  row: { minHeight: m.height.field, flexDirection: 'row', alignItems: 'center' },
  touch: {
    width: m.height.touch,
    minHeight: m.height.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: m.selectionRing,
    borderRadius: m.radius.mark,
  },
  box: {
    width: m.glyph.check,
    height: m.glyph.check,
    borderWidth: m.border,
    borderRadius: m.radius.mark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: { fontFamily: m.fontBold, fontSize: m.type.body, fontWeight: '700' },
  titleTouch: {
    flex: 1,
    minHeight: m.height.touch,
    justifyContent: 'center',
    borderWidth: m.selectionRing,
    borderRadius: m.radius.mark,
  },
  title: {
    paddingVertical: m.space.sm,
    fontFamily: m.fontFamily,
    fontSize: m.type.body,
    lineHeight: m.type.body * m.lineHeight.body,
  },
});
