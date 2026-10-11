import { useState } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { todoWriteKey, type NodiiClient, type TodoRecord } from '@nodii/api';
import { checkColor, goalTint, goalInk, type Goal } from '@nodii/core';
import { t } from '@nodii/i18n';
import { lightColors, metrics as m, useTheme } from '../../../lib/theme';
import { SwipeableRow } from '../../components/gestures/SwipeableRow';
import { actionLabel, todoActions } from './actions';
import { useTodoActions } from './useTodoActions';
import { TodoMenu } from './TodoMenu';

/** TODO-02: 각 행이 독립된 요청을 가져 다른 행의 체크를 막지 않는다. */
export function TodoRow({
  todo,
  goal,
  client,
  weekStart,
}: {
  todo: TodoRecord;
  goal: Goal;
  client: NodiiClient;
  weekStart: 0 | 1;
}) {
  const { colors, isDark } = useTheme();
  const [menu, setMenu] = useState(false);
  const actions = useTodoActions(client, weekStart, todo);
  const [focused, setFocused] = useState(false);
  const creating =
    useIsMutating({
      mutationKey: ['write', 'todo', 'create'],
      predicate: (mutation) => {
        const variables: unknown = mutation.state.variables;
        return (
          !!variables &&
          typeof variables === 'object' &&
          'id' in variables &&
          variables.id === todo.id
        );
      },
    }) > 0;
  const updating = useIsMutating({ mutationKey: todoWriteKey(todo.id) }) > 0;
  const locked = updating || creating || actions.pending;
  function check() {
    if (!locked) void actions.run('toggle');
  }
  function openMenu() {
    if (!locked && !actions.locallyBusy()) setMenu(true);
  }
  const swipeActions = todoActions
    .filter((action) => action.swipe)
    .map(({ id }) => ({
      id,
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
        if (!locked && id !== 'rename') void actions.run(id);
      },
    }));
  return (
    <>
      <SwipeableRow
        id={todo.id}
        disabled={locked}
        leading={swipeActions[0]!}
        trailing={swipeActions.slice(1)}
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
      {menu && (
        <TodoMenu
          todo={todo}
          goal={goal}
          locked={locked}
          onAction={(action) => void actions.run(action)}
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
