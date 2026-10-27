import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Easing, Keyboard, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@nodii/i18n';
import { metrics as m, useReducedMotion, useTheme } from '../../lib/theme';
import { enqueueToast, expireToasts, undoLifetime, type ToastEntry } from './undo-queue';

type ShowToast = (message: string, undo?: () => Promise<void>) => void;
const ToastContext = createContext<ShowToast>(() => {});
const ToastViewContext = createContext<{
  entries: ToastEntry[];
  bottom: number;
  dismiss(id: number): void;
  restore(id: number): void;
  registerPortal(id: symbol, mounted: boolean): void;
  activePortal?: symbol;
  setBottom(value: number): void;
  clear(): void;
}>({
  entries: [],
  bottom: 0,
  dismiss: () => {},
  restore: () => {},
  registerPortal: () => {},
  setBottom: () => {},
  clear: () => {},
});
/** TODO-04/NFR-12: 행이 목록에서 사라져도 각각의 복원 작업은 Provider에 살아 있다. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);
  const [portals, setPortals] = useState<symbol[]>([]);
  const [bottom, setBottom] = useState(0);
  const nextId = useRef(0);
  const restoring = useRef(new Set<number>());
  const show = useCallback<ShowToast>((text, undo) => {
    const now = Date.now();
    const entry: ToastEntry = { id: ++nextId.current, text, expiresAt: now + undoLifetime, undo };
    setEntries((previous) => enqueueToast(previous, entry, now));
  }, []);
  const dismiss = useCallback(
    (id: number) => setEntries((previous) => previous.filter((entry) => entry.id !== id)),
    [],
  );
  const clear = useCallback(() => setEntries([]), []);
  const registerPortal = useCallback(
    (id: symbol, mounted: boolean) =>
      setPortals((current) =>
        mounted
          ? [...current.filter((entry) => entry !== id), id]
          : current.filter((entry) => entry !== id),
      ),
    [],
  );
  useEffect(() => {
    const next = Math.min(
      ...entries.filter((entry) => !entry.busy).map((entry) => entry.expiresAt),
    );
    if (!Number.isFinite(next)) return;
    const timer = setTimeout(
      () => setEntries((previous) => expireToasts(previous, Date.now())),
      Math.max(0, next - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [entries]);
  async function restore(id: number) {
    const entry = entries.find((item) => item.id === id);
    if (!entry?.undo || restoring.current.has(id) || entry.expiresAt <= Date.now()) return;
    restoring.current.add(id);
    setEntries((previous) =>
      previous.map((item) => (item.id === id ? { ...item, busy: true } : item)),
    );
    try {
      await entry.undo();
      dismiss(id);
    } catch {
      // 기존 훅은 데이터 롤백을 맡고 여기서는 복원 버튼을 다시 열어 둔다.
      setEntries((previous) =>
        previous.map((item) =>
          item.id === id ? { ...item, busy: false, expiresAt: Date.now() + undoLifetime } : item,
        ),
      );
      show(t('todo.undo.failed'));
    } finally {
      restoring.current.delete(id);
    }
  }
  return (
    <ToastContext.Provider value={show}>
      <ToastViewContext.Provider
        value={{
          entries,
          bottom,
          dismiss,
          restore: (id) => void restore(id),
          registerPortal,
          activePortal: portals[portals.length - 1],
          setBottom,
          clear,
        }}
      >
        {children}
        {portals.length === 0 && <ToastView />}
      </ToastViewContext.Provider>
    </ToastContext.Provider>
  );
}
/** MOB-04: 고정 추가 바 높이만큼 올리고 사용자 화면을 떠나면 작업 안내를 정리한다. */
export function ToastInset({ bottom }: { bottom: number }) {
  const { setBottom, clear } = useContext(ToastViewContext);
  useEffect(() => {
    setBottom(bottom);
    return () => {
      setBottom(0);
      clear();
    };
  }, [bottom, setBottom, clear]);
  return null;
}
/** 네이티브 Modal은 별도 창이므로 같은 토스트를 그 창 안에 한 번만 그린다. */
export function ToastPortal({ bottom = 0 }: { bottom?: number } = {}) {
  const { registerPortal, activePortal } = useContext(ToastViewContext);
  const [id] = useState(() => Symbol('toast-portal'));
  useLayoutEffect(() => {
    registerPortal(id, true);
    return () => registerPortal(id, false);
  }, [registerPortal, id]);
  return activePortal === id ? <ToastView portal portalBottom={bottom} /> : null;
}
function ToastView({
  portal = false,
  portalBottom = 0,
}: {
  portal?: boolean;
  portalBottom?: number;
}) {
  const { entries, bottom, dismiss, restore } = useContext(ToastViewContext);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(() => Keyboard.metrics?.()?.height ?? 0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) =>
      setKeyboardHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return entries.length ? (
    <ScrollView
      style={[
        styles.stack,
        {
          bottom:
            (portal
              ? Math.max(portalBottom, insets.bottom, keyboardHeight)
              : Math.max(bottom, insets.bottom, keyboardHeight)) + m.toastInset,
        },
      ]}
      contentContainerStyle={styles.stackContent}
      keyboardShouldPersistTaps="always"
    >
      {entries.map((entry) => (
        <ToastFrame key={entry.id}>
          <Text
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
            style={[styles.text, { color: colors.bg }]}
          >
            {entry.text}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(entry.undo ? 'todo.undo' : 'common.dismiss')}
            accessibilityState={{ disabled: !!entry.busy, busy: !!entry.busy }}
            disabled={entry.busy}
            onPress={() => (entry.undo ? restore(entry.id) : dismiss(entry.id))}
            style={({ pressed }) => [
              styles.action,
              {
                opacity: pressed || entry.busy ? m.pressedOpacity : 1,
              },
            ]}
          >
            <Text style={[styles.actionText, { color: colors.bg }]}>
              {t(entry.undo ? 'todo.undo' : 'common.dismiss')}
            </Text>
          </Pressable>
        </ToastFrame>
      ))}
    </ScrollView>
  ) : null;
}
/** 모션 감소에서는 즉시, 그 외에는 토큰 시간에 맞춰 토스트를 올린다. */
function ToastFrame({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(1));
  useEffect(() => {
    progress.stopAnimation();
    if (reduced) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: m.motion.toast,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced]);
  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: colors.ink,
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [m.toastInset, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
/** 실패 안내와 실행 취소는 같은 카탈로그/표시 경로를 사용한다. */
export function useToast() {
  return useContext(ToastContext);
}
const styles = StyleSheet.create({
  stack: { position: 'absolute', left: m.space.lg, right: m.space.lg, maxHeight: '40%' },
  stackContent: { gap: m.space.sm },
  toast: {
    minHeight: m.height.button,
    paddingHorizontal: m.space.lg,
    paddingVertical: m.space.xs,
    borderRadius: m.radius.pill,
    boxShadow: '0 12px 32px rgba(17,19,24,0.24)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: m.space.sm,
  },
  text: {
    flex: 1,
    fontFamily: m.fontMedium,
    fontSize: m.type.supporting,
    lineHeight: m.type.supporting * m.lineHeight.body,
  },
  action: {
    minHeight: m.height.touch,
    minWidth: m.height.touch,
    justifyContent: 'center',
    borderWidth: 0,
    borderRadius: m.radius.mark,
    paddingHorizontal: m.space.xs,
  },
  actionText: { fontFamily: m.fontExtraBold, fontSize: m.type.button },
});
