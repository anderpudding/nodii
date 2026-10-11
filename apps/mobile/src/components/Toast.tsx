import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../lib/theme';
import { Button } from './Button';

const ToastContext = createContext<(message: string) => void>(() => {});
const ToastViewContext = createContext<{
  message: { text: string } | null;
  dismiss(): void;
  registerPortal(delta: number): void;
}>({ message: null, dismiss: () => {}, registerPortal: () => {} });
/** NFR-12: 앱 전체에서 실패를 숨기지 않고 접근 가능한 안내를 제공한다. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<{ text: string } | null>(null);
  const [portals, setPortals] = useState(0);
  const show = useCallback((text: string) => setMessage({ text }), []);
  const dismiss = useCallback(() => setMessage(null), []);
  const registerPortal = useCallback((delta: number) => setPortals((count) => count + delta), []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [message]);
  return (
    <ToastContext.Provider value={show}>
      <ToastViewContext.Provider value={{ message, dismiss, registerPortal }}>
        {children}
        {portals === 0 && <ToastView />}
      </ToastViewContext.Provider>
    </ToastContext.Provider>
  );
}
/** 네이티브 Modal은 별도 창이므로 같은 토스트를 그 창 안에 한 번만 그린다 (NFR-12). */
export function ToastPortal() {
  const { registerPortal } = useContext(ToastViewContext);
  useEffect(() => {
    registerPortal(1);
    return () => registerPortal(-1);
  }, [registerPortal]);
  return <ToastView />;
}
function ToastView() {
  const { message, dismiss } = useContext(ToastViewContext);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return message ? (
    <View
      style={[
        styles.toast,
        {
          top: insets.top + m.space.sm,
          backgroundColor: colors.surface,
          borderColor: colors.field,
        },
      ]}
    >
      <Text
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        style={[styles.text, { color: colors.ink }]}
      >
        {message.text}
      </Text>
      <Button label={t('common.dismiss')} secondary onPress={dismiss} />
    </View>
  ) : null;
}
export function useToast() {
  return useContext(ToastContext);
}
const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: m.space.lg,
    right: m.space.lg,
    padding: m.space.lg,
    borderWidth: m.border,
    borderRadius: m.radius.card,
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
});
