import { SheetHeader } from '../../components/SheetHeader';
import { useLocale } from '../../../lib/use-locale';
import { useOnline } from '../../../lib/connectivity';
import { useCallback, useMemo, useRef, useState } from 'react';
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
import type { TodoRecord } from '@nodii/api';
import { normalizeTitle, type Goal } from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useReducedMotion, useTheme } from '../../../lib/theme';
import { ToastPortal } from '../../components/Toast';
import { Button } from '../../components/Button';
import { ActionIcon } from '../../components/ActionIcon';
import { actionLabel, todoActions, type TodoAction } from './actions';
import { GoalBadge } from './GoalBadge';
import { submissionTitle } from './model';

/** MOB-01/04: 밀기 동작을 모두 메뉴에 노출하고 이름은 별도 시트에서 고친다. */
export function TodoMenu({
  todo,
  goal,
  locked,
  onAction,
  onSave,
  onClose,
}: {
  todo: TodoRecord;
  goal: Goal;
  locked: boolean;
  onAction(action: Exclude<TodoAction, 'rename'>): void;
  onSave(title: string): Promise<void>;
  onClose(): void;
}) {
  useLocale();
  const { colors } = useTheme();
  const online = useOnline();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.title);
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const input = useRef<TextInput>(null);
  const busy = useRef(false);
  const discardTitle = t('mobile.add.discard.title');
  const discardDescription = t('mobile.add.discard.description');
  const discardContinue = t('mobile.add.discard.continue');
  const discardAction = t('mobile.add.discard.action');
  const close = useCallback(() => {
    if (saving) return;
    if (!editing || draft === todo.title) {
      onClose();
      return;
    }
    Alert.alert(discardTitle, discardDescription, [
      { text: discardContinue, style: 'cancel' },
      { text: discardAction, style: 'destructive', onPress: onClose },
    ]);
  }, [
    saving,
    editing,
    draft,
    todo.title,
    onClose,
    discardTitle,
    discardDescription,
    discardContinue,
    discardAction,
  ]);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.dy > m.space.md && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > m.height.touch) close();
        },
        // close는 현재 입력/쓰기 상태를 읽어 폐기 확인을 유지한다.
      }),
    [close],
  );
  async function submit(event?: unknown) {
    if (!online || busy.current || locked) return;
    const title = submissionTitle(draft, event);
    if (!title) {
      // IME 확인 이벤트는 검증 오류도 띄우지 않는다.
      if (!normalizeTitle(draft)) setInvalid(true);
      return;
    }
    if (title === todo.title) {
      onClose();
      return;
    }
    busy.current = true;
    setSaving(true);
    try {
      await onSave(title);
      onClose();
    } catch {
      /* 기존 훅이 캐시 롤백과 토스트를 처리하며 입력은 유지한다. */
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return (
    <Modal transparent visible animationType={reduced ? 'none' : 'slide'} onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.overlay, { backgroundColor: colors.scrim }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('mobile.menu.dismiss')}
          onPress={close}
          style={styles.backdrop}
        />
        <View
          testID="todo-menu-sheet"
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
          {editing ? (
            <>
              <SheetHeader
                title={t('todo.action.rename')}
                headerStyle={styles.header}
                titleStyle={[styles.heading, { color: colors.ink }]}
                leading={
                  <Button
                    label={t('mobile.add.cancel')}
                    secondary
                    quiet
                    disabled={saving}
                    onPress={close}
                  />
                }
                trailing={
                  <Button
                    label={t('mobile.rename.save')}
                    quiet
                    busy={saving}
                    disabled={!online || saving || locked || !normalizeTitle(draft)}
                    onPress={() => void submit()}
                  />
                }
              />
              <ScrollView keyboardShouldPersistTaps="always" contentContainerStyle={styles.editor}>
                <TextInput
                  ref={input}
                  autoFocus
                  value={draft}
                  onChangeText={(value) => {
                    setDraft(value);
                    setInvalid(false);
                  }}
                  editable={!saving}
                  accessibilityLabel={t('todo.title')}
                  returnKeyType="done"
                  submitBehavior="submit"
                  onSubmitEditing={(event) => void submit(event.nativeEvent)}
                  onFocus={() => setFocused('input')}
                  onBlur={() => setFocused(null)}
                  selectionColor={goal.color}
                  style={[
                    styles.input,
                    {
                      color: colors.ink,
                      backgroundColor: colors.chip,
                      borderWidth: 1.5,
                      borderColor: focused === 'input' ? colors.ink : colors.chip,
                    },
                  ]}
                />
                {invalid && (
                  <Text
                    accessibilityRole="alert"
                    style={[styles.supporting, { color: colors.danger }]}
                  >
                    {t('mobile.rename.invalid')}
                  </Text>
                )}
              </ScrollView>
            </>
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              <View style={styles.header}>
                <GoalBadge goal={goal} />
                <Text numberOfLines={1} style={[styles.menuTitle, { color: colors.ink }]}>
                  {todo.title}
                </Text>
              </View>
              {!online && (
                <Text style={[styles.supporting, { color: colors.muted }]}>
                  {t('sync.writeDisabled')}
                </Text>
              )}
              {todoActions.map(({ id }) => (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityLabel={
                    id === 'move' ? t('todo.action.move.menu') : actionLabel(id, todo.isDone)
                  }
                  accessibilityState={{ disabled: !online || locked, busy: locked }}
                  accessibilityHint={!online ? t('sync.writeDisabled') : undefined}
                  disabled={!online || locked}
                  onPress={() => {
                    if (id === 'rename') setEditing(true);
                    else {
                      onClose();
                      onAction(id);
                    }
                  }}

                  style={({ pressed }) => [
                    styles.item,
                    {
                      borderBottomColor: colors.line,
                      borderColor: colors.surface,
                      opacity: pressed ? m.pressedOpacity : 1,
                    },
                  ]}
                >
                  <ActionIcon action={id} color={id === 'delete' ? colors.danger : colors.ink} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.itemText,
                        { color: id === 'delete' ? colors.danger : colors.ink },
                      ]}
                    >
                      {id === 'move' ? t('todo.action.move.menu') : actionLabel(id, todo.isDone)}
                    </Text>
                    {id === 'move' && (
                      <Text style={[styles.supporting, { color: colors.muted }]}>
                        {t('todo.action.move.description')}
                      </Text>
                    )}
                  </View>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('mobile.add.cancel')}
                onPress={close}
                style={({ pressed }) => [
                  styles.cancel,
                  {
                    borderColor: colors.chip,
                    backgroundColor: colors.chip,
                    opacity: pressed ? m.pressedOpacity : 1,
                  },
                ]}
              >
                <Text style={[styles.cancelText, { color: colors.ink }]}>
                  {t('mobile.add.cancel')}
                </Text>
              </Pressable>
            </ScrollView>
          )}
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
    boxShadow: '0 -16px 48px rgba(17,19,24,0.16)',
  },
  handleTouch: { minHeight: m.height.touch, alignItems: 'center', justifyContent: 'center' },
  handle: { width: m.handle.width, height: m.handle.height, borderRadius: m.radius.pill },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: m.space.md,
    paddingBottom: m.space.lg,
  },
  heading: { flex: 1, fontFamily: m.fontExtraBold, fontSize: m.type.heading, textAlign: 'center' },
  menuTitle: { flex: 1, fontFamily: m.fontExtraBold, fontSize: m.type.body },
  content: { paddingBottom: m.space.lg },
  item: {
    minHeight: m.height.menu,
    flexDirection: 'row',
    alignItems: 'center',
    gap: m.space.lg,
    borderWidth: 0,
    borderBottomWidth: m.border,
    paddingHorizontal: m.space.xs,
    paddingVertical: m.space.sm,
  },
  itemText: { fontFamily: m.fontFamily, fontSize: m.type.body },
  cancelText: { fontFamily: m.fontExtraBold, fontSize: m.type.button },
  cancel: {
    minHeight: m.height.button,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderRadius: m.radius.pill,
    marginTop: m.space.lg,
  },
  editor: { gap: m.space.sm, paddingBottom: m.space.lg },
  input: {
    minHeight: m.height.field,
    paddingHorizontal: m.space.lg,
    paddingVertical: m.space.md,
    borderWidth: m.selectionRing,
    borderRadius: m.radius.field,
    fontFamily: m.fontFamily,
    fontSize: m.type.body,
  },
  supporting: { fontFamily: m.fontMedium, fontSize: m.type.supporting },
});
