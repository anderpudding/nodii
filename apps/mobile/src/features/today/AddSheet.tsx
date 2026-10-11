import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as crypto from 'expo-crypto';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys, useCreateTodo, type NodiiClient, type TodoRecord } from '@nodii/api';
import { monthKeyOf, normalizeTitle, type Goal, type ISODate } from '@nodii/core';
import { t, withParticle } from '@nodii/i18n';
import { metrics as m, useReducedMotion, useTheme } from '../../../lib/theme';
import { useUIStore } from '../../stores/ui';
import { ToastPortal, useToast } from '../../components/Toast';
import { Button } from '../../components/Button';
import { GoalBadge } from './GoalBadge';
import { newTodo, preferredGoal, submissionTitle } from './model';

/** MOB-03/05: 입력·추가 버튼을 키보드 위에 두고 저장 뒤 다음 입력을 계속 받는다. */
export function AddSheet({
  client,
  date,
  today,
  goals,
  weekStart,
  onClose,
}: {
  client: NodiiClient;
  date: ISODate;
  today: ISODate;
  goals: Goal[];
  weekStart: 0 | 1;
  onClose(): void;
}) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const cache = useQueryClient();
  const toast = useToast();
  const lastAddedGoalId = useUIStore((state) => state.lastAddedGoalId);
  const [goalId, setGoalId] = useState(() => preferredGoal(goals, lastAddedGoalId)?.id ?? null);
  const [title, setTitle] = useState('');
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);
  const busy = useRef(false);
  const submittedTitle = useRef('');
  const goal = preferredGoal(goals, goalId);
  const create = useCreateTodo(client, weekStart, {
    // 시트를 요청 중 닫아도 훅의 오류 안내는 실행된다 (NFR-12).
    onError: () => {
      const failedTitle = submittedTitle.current;
      toast(
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
    if (!value || !goal || busy.current) return;
    // 렌더 시점 배열 대신 최신 낙관적 월 캐시를 읽어 연속 입력 키를 계산한다.
    const rows = cache.getQueryData<TodoRecord[]>(queryKeys.todos(monthKeyOf(date))) ?? [];
    const todo = newTodo(crypto.randomUUID(), goal.id, date, value, rows);
    if (!todo) return;
    busy.current = true;
    submittedTitle.current = todo.title;
    setTitle('');
    input.current?.focus();
    try {
      await create.mutateAsync(todo);
      // 시트를 요청 중 닫아도 직전에 추가한 목표는 성공 뒤 기억한다.
      useUIStore.getState().rememberAddedGoal(todo.goalId);
    } catch {
      // 훅의 onError가 롤백·제목 복원·토스트를 모두 처리한다.
    } finally {
      busy.current = false;
    }
  }
  function close() {
    if (!title.trim()) {
      onClose();
      return;
    }
    Alert.alert(t('mobile.add.discard.title'), t('mobile.add.discard.description'), [
      { text: t('mobile.add.discard.continue'), style: 'cancel' },
      { text: t('mobile.add.discard.action'), style: 'destructive', onPress: onClose },
    ]);
  }
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.dy > m.space.md && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy <= m.height.touch) return;
          if (!title.trim()) onClose();
          else
            Alert.alert(t('mobile.add.discard.title'), t('mobile.add.discard.description'), [
              { text: t('mobile.add.discard.continue'), style: 'cancel' },
              { text: t('mobile.add.discard.action'), style: 'destructive', onPress: onClose },
            ]);
        },
      }),
    [title, onClose],
  );
  const dateLabel = new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
  return (
    <Modal
      transparent
      visible
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={close}
      onShow={() => input.current?.focus()}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.overlay, { backgroundColor: colors.scrim }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('mobile.add.dismiss')}
          onPress={close}
          style={styles.backdrop}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: Math.max(insets.bottom, m.space.lg),
              maxHeight: '100%',
            },
          ]}
        >
          <View {...pan.panHandlers} style={styles.handleTouch}>
            <View style={[styles.handle, { backgroundColor: colors.ink, opacity: 0.2 }]} />
          </View>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[styles.heading, { color: colors.ink }]}>
              {t('todo.add')}
            </Text>
            <Button label={t('mobile.add.cancel')} secondary onPress={close} />
          </View>
          <ScrollView keyboardShouldPersistTaps="always" contentContainerStyle={styles.content}>
            <ScrollView
              horizontal
              accessibilityLabel={t('mobile.add.goals')}
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              contentContainerStyle={styles.goals}
            >
              {goals
                .filter((item) => item.archivedAt === null)
                .map((item) => (
                  <GoalBadge
                    key={item.id}
                    goal={item}
                    selected={goal?.id === item.id}
                    onPress={() => setGoalId(item.id)}
                  />
                ))}
            </ScrollView>
            <TextInput
              ref={input}
              autoFocus
              value={title}
              onChangeText={setTitle}
              accessibilityLabel={t('todo.title')}
              placeholder={t('mobile.add.placeholder')}
              placeholderTextColor={colors.muted}
              selectionColor={goal?.color ?? colors.ink}
              returnKeyType="done"
              submitBehavior="submit"
              blurOnSubmit={false}
              onSubmitEditing={(event) => void submit(event.nativeEvent)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={[
                styles.input,
                {
                  color: colors.ink,
                  backgroundColor: colors.bg,
                  borderColor: focused ? colors.focus : colors.field,
                },
              ]}
            />
            <View style={[styles.date, { borderTopColor: colors.line }]}>
              <Text style={[styles.supporting, { color: colors.muted }]}>
                {t('mobile.add.date')}
              </Text>
              <Text style={[styles.supporting, { color: colors.ink2 }]}>
                {date === today ? t('mobile.add.date.today', { date: dateLabel }) : dateLabel}
              </Text>
            </View>
            <Button
              label={t('mobile.add.action')}
              busy={create.isPending}
              disabled={!goal || !normalizeTitle(title) || create.isPending}
              onPress={() => void submit()}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
      <ToastPortal />
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, minHeight: m.height.touch },
  sheet: {
    borderTopLeftRadius: m.radius.sheet,
    borderTopRightRadius: m.radius.sheet,
    paddingHorizontal: m.space.lg,
    flexShrink: 1,
  },
  handleTouch: { minHeight: m.height.touch, alignItems: 'center', justifyContent: 'center' },
  handle: { width: m.handle.width, height: m.handle.height, borderRadius: m.radius.pill },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: m.space.sm,
  },
  heading: { flex: 1, fontFamily: m.fontBold, fontWeight: '700', fontSize: m.type.heading },
  content: { gap: m.space.lg, paddingBottom: m.space.lg },
  goals: { gap: m.space.sm, paddingVertical: m.space.xs },
  input: {
    minHeight: m.height.field,
    paddingHorizontal: m.space.lg,
    paddingVertical: m.space.md,
    borderWidth: m.selectionRing,
    borderRadius: m.radius.field,
    fontFamily: m.fontFamily,
    fontSize: m.type.body,
  },
  date: {
    minHeight: m.height.field,
    borderTopWidth: m.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: m.space.md,
  },
  supporting: { fontFamily: m.fontMedium, fontSize: m.type.supporting },
});
