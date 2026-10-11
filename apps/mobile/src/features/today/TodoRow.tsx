import { useRef, useState } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { todoWriteKey, useToggleTodo, type NodiiClient, type TodoRecord } from '@nodii/api';
import { checkColor, type Goal } from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';
import { useToast } from '../../components/Toast';

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
  const { colors } = useTheme();
  const toast = useToast();
  const busy = useRef(false);
  const [focused, setFocused] = useState(false);
  const toggle = useToggleTodo(client, weekStart, todo.id, {
    onError: () => toast(t('todo.save.failed')),
  });
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
  const locked = updating || creating;
  function check() {
    if (busy.current || locked) return;
    busy.current = true;
    toggle.mutate(todo, {
      onSettled: () => {
        busy.current = false;
      },
    });
  }
  return (
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
    </View>
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
  title: {
    flex: 1,
    paddingVertical: m.space.sm,
    fontFamily: m.fontFamily,
    fontSize: m.type.body,
    lineHeight: m.type.body * m.lineHeight.body,
  },
});
