import { getLocale } from '@nodii/i18n';
import { StatusBar } from 'expo-status-bar';
import { useMemo, type ReactNode } from 'react';
import { Modal, PanResponder, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { metrics as m, useTheme } from '../../lib/theme';
import { Button } from './Button';
import { SwipeRows } from './gestures/SwipeableRow';
import { ToastPortal } from './Toast';

/** MOB-04: 관리 화면은 가장자리 뒤로 가기와 safe area를 같은 규칙으로 유지한다. */
export function ManagementScreen({
  title,
  back,
  onClose,
  children,
  footer,
  testID,
  swipeRows = false,
  inline = false,
  hostOnly = false,
}: {
  title: string;
  back: string;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
  testID: string;
  swipeRows?: boolean;
  inline?: boolean;
  hostOnly?: boolean;
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const edge = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.x0 <= m.height.touch &&
          gesture.dx > m.space.md &&
          Math.abs(gesture.dy) < m.space.sm,
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx > m.height.touch) onClose();
        },
      }),
    [onClose],
  );
  const scroll = (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="always">
      {children}
    </ScrollView>
  );
  const page = (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View
        testID={testID}
        accessibilityViewIsModal
        {...edge.panHandlers}
        style={[
          styles.screen,
          {
            backgroundColor: colors.bg,
            paddingTop: inline ? 0 : insets.top,
            paddingBottom: inline ? 0 : Math.max(insets.bottom, m.space.lg),
          },
        ]}
      >
        <View style={styles.header}>
          <Button secondary quiet label={back} onPress={onClose} />
          <Text
            numberOfLines={getLocale() === 'en' ? 1 : undefined}
            adjustsFontSizeToFit={getLocale() === 'en'}
            accessibilityRole="header"
            style={[styles.title, { color: colors.ink }]}
          >
            {title}
          </Text>
        </View>
        {swipeRows ? <SwipeRows>{scroll}</SwipeRows> : scroll}
        {footer && (
          <View
            style={[styles.footer, { backgroundColor: colors.bg, borderTopColor: colors.line }]}
          >
            {footer}
          </View>
        )}
        <ToastPortal
          bottom={
            footer ? m.height.button + m.space.lg * 2 + Math.max(insets.bottom, m.space.lg) : 0
          }
        />
      </View>
    </>
  );
  return inline ? (
    page
  ) : (
    <Modal visible animationType="none" onRequestClose={onClose}>
      {hostOnly ? (
        <View
          style={{
            flex: 1,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            backgroundColor: colors.bg,
          }}
        >
          {children}
        </View>
      ) : (
        page
      )}
    </Modal>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    alignItems: 'flex-start',
    paddingHorizontal: m.space.lg,
    gap: m.space.sm,
  },
  title: {
    fontFamily: m.fontExtraBold,
    fontSize: m.type.title,
    letterSpacing: m.letterSpacing.title,
  },
  content: {
    paddingHorizontal: m.space.lg,
    paddingTop: m.space.sm,
    paddingBottom: m.space.lg,
    gap: m.space.group,
  },
  footer: { padding: m.space.lg, borderTopWidth: m.border },
});
