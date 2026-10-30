import { SproutCheck } from '../../components/SproutCheck';
import { ActionIcon } from '../../components/ActionIcon';
import { useEffect, useRef, useState } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as crypto from 'expo-crypto';
import { useQueryClient } from '@tanstack/react-query';
import {
  monthTodosOptions,
  queryKeys,
  useCreateTodo,
  type NodiiClient,
  type TodoRecord,
} from '@nodii/api';
import { monthKeyOf, normalizeTitle, type Goal, type ISODate } from '@nodii/core';
import { formatISODate, t, withParticle } from '@nodii/i18n';
import { useOnline } from '../../../lib/connectivity';
import { metrics as m, useTheme } from '../../../lib/theme';
import { useUIStore } from '../../stores/ui';
import { useToast } from '../../components/Toast';
import { DatePickSheet } from './DatePickSheet';
import { newTodo, submissionTitle } from './model';

/** TODO-01/MOB-03/05: 기존 추가 mutation을 목표 아래에서 연속 입력하며 실패도 복원한다. */
export function InlineAdd({
  client,
  goal,
  date: initialDate,
  today,
  weekStart,
  timeZone,
  isDateLocked,
  onClose,
  onFocus,
}: {
  client: NodiiClient;
  goal: Goal;
  date: ISODate;
  today: ISODate;
  weekStart: 0 | 1;
  timeZone: string;
  isDateLocked(date: ISODate): boolean;
  onClose(): void;
  onFocus(): void;
}) {
  const { colors } = useTheme();
  const online = useOnline();
  const cache = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate);
  const [picking, setPicking] = useState(false);
  const pickingRef = useRef(false);
  const input = useRef<TextInput>(null);
  const busy = useRef(false);
  const submittedTitle = useRef('');
  const accessoryId = `add-${goal.id}`;
  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', onFocus);
    return () => subscription.remove();
  }, [onFocus]);
  const create = useCreateTodo(client, weekStart, {
    // 입력을 요청 중 닫아도 훅의 오류 안내는 실행된다 (NFR-12).
    onError: () => {
      const failedTitle = submittedTitle.current;
      toast(() =>
        t('todo.add.failed', {
          title: failedTitle,
          particle: withParticle(failedTitle, '을/를').slice(failedTitle.length),
        }),
      );
      setTitle((draft) => draft || failedTitle);
    },
  });
  async function submit(event?: unknown) {
    const value = submissionTitle(title, event);
    if (!online || !goal || busy.current || isDateLocked(date)) return;
    if (!value) {
      if (!title.trim()) onClose();
      return;
    }
    busy.current = true;
    let rows: TodoRecord[];
    try {
      await cache.ensureQueryData(monthTodosOptions(client, monthKeyOf(date), weekStart));
      rows = cache.getQueryData<TodoRecord[]>(queryKeys.todos(monthKeyOf(date))) ?? [];
    } catch {
      busy.current = false;
      toast(() => t('todo.save.failed'));
      return;
    }
    const todo = newTodo(crypto.randomUUID(), goal.id, date, value, rows);
    if (!todo) {
      busy.current = false;
      return;
    }
    submittedTitle.current = todo.title;
    setTitle('');
    input.current?.focus();
    try {
      await create.mutateAsync(todo);
      // 입력을 요청 중 닫아도 직전에 추가한 목표는 성공 뒤 기억한다.
      useUIStore.getState().rememberAddedGoal(todo.goalId);
    } catch {
      // 훅의 onError가 롤백·제목 복원·토스트를 모두 처리한다.
    } finally {
      busy.current = false;
    }
  }
  const dateLabel = formatISODate(date, {
    month: 'long',
    day: 'numeric',
  });
  // M8: 입력 줄은 chip 채움과 같은 싹이 씨앗을 쓴다.
  return (
    <View style={styles.container}>
      <View style={[styles.row, { backgroundColor: colors.chip }]}>
        <View accessible={false} style={styles.checkSpace}>
          <SproutCheck color={goal.color} />
        </View>
        <TextInput
          ref={input}
          autoFocus
          value={title}
          onChangeText={setTitle}
          accessibilityLabel={t('todo.title')}
          placeholder={t('mobile.add.placeholder')}
          placeholderTextColor={colors.muted}
          selectionColor={goal.color}
          inputAccessoryViewID={accessoryId}
          returnKeyType="done"
          submitBehavior="submit"
          blurOnSubmit={false}
          onSubmitEditing={(event) => void submit(event.nativeEvent)}
          onFocus={onFocus}
          onBlur={() => {
            if (!pickingRef.current) onClose();
          }}
          style={[styles.input, { color: colors.ink, borderColor: colors.ink }]}
        />
      </View>
      <InputAccessoryView nativeID={accessoryId} backgroundColor={colors.bg}>
        <View
          style={[styles.accessory, { backgroundColor: colors.bg, borderTopColor: colors.line }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('mobile.add.date.pick')}
            onPress={() => {
              pickingRef.current = true;
              setPicking(true);
              Keyboard.dismiss();
            }}
            style={({ pressed }) => [styles.date, { opacity: pressed ? m.pressedOpacity : 1 }]}
          >
            <ActionIcon action="move" color={colors.ink2} />
            <Text style={[styles.label, { color: colors.ink2 }]}>
              {date === today ? t('mobile.add.date.today', { date: dateLabel }) : dateLabel}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('mobile.add.action')}
            accessibilityState={{
              busy: create.isPending,
              disabled: !online || !normalizeTitle(title) || create.isPending || isDateLocked(date),
            }}
            disabled={!online || !normalizeTitle(title) || create.isPending || isDateLocked(date)}
            onPress={() => void submit()}
            style={({ pressed }) => [
              styles.action,
              { opacity: pressed || !online ? m.pressedOpacity : 1 },
            ]}
          >
            <Text style={[styles.label, { color: colors.ink }]}>{t('mobile.add.action')}</Text>
          </Pressable>
        </View>
      </InputAccessoryView>
      {picking && (
        <DatePickSheet
          client={client}
          title={title || t('todo.add')}
          date={date}
          today={today}
          weekStart={weekStart}
          timeZone={timeZone}
          onSelect={setDate}
          onClose={() => {
            setPicking(false);
            pickingRef.current = false;
            input.current?.focus();
          }}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { paddingHorizontal: m.space.lg },
  row: {
    minHeight: m.height.field,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: m.radius.field,
  },
  checkSpace: { width: m.height.touch, alignItems: 'center' },
  input: {
    flex: 1,
    minHeight: m.height.field,
    borderWidth: 1.5,
    borderRadius: m.radius.field,
    paddingHorizontal: m.space.sm,
    fontFamily: m.fontFamily,
    fontSize: m.type.body,
  },
  accessory: {
    minHeight: m.space.page,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: m.border,
    paddingHorizontal: m.space.lg,
    gap: m.space.sm,
  },
  date: {
    flex: 1,
    minHeight: m.height.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: m.space.md,
  },
  action: {
    minHeight: m.height.touch,
    minWidth: m.height.touch,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: { fontFamily: m.fontExtraBold, fontSize: m.type.button },
});
