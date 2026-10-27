import { useMemo, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@nodii/i18n';
import { metrics as m, useReducedMotion, useTheme } from '../../lib/theme';
import { Button } from './Button';
import { ToastPortal } from './Toast';

/** MOB-04: 새 날짜·하루 시트의 safe area, 닫기와 손잡이 제스처를 한 곳에서 유지한다. */
export function BottomSheet({
  title,
  testID,
  children,
  onClose,
  bottomCancel = false,
  header,
  keyboard = false,
}: {
  title: string;
  testID: string;
  children: ReactNode;
  onClose(): void;
  bottomCancel?: boolean;
  header?: ReactNode;
  keyboard?: boolean;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.dy > m.space.md && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > m.height.touch) onClose();
        },
      }),
    [onClose],
  );
  return (
    <Modal transparent visible animationType={reduced ? 'none' : 'slide'} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={keyboard ? (Platform.OS === 'ios' ? 'padding' : 'height') : undefined}
        style={[styles.overlay, { backgroundColor: colors.scrim, paddingTop: insets.top }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.dismiss')}
          onPress={onClose}
          style={styles.backdrop}
        />
        <View
          testID={testID}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: Math.max(insets.bottom, m.space.lg),
            },
          ]}
        >
          <View {...pan.panHandlers} style={styles.handleTouch}>
            <View style={[styles.handle, { backgroundColor: colors.ink, opacity: 0.2 }]} />
          </View>
          {header ?? (
            <View style={styles.header}>
              <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>
                {title}
              </Text>
              {!bottomCancel && (
                <Button label={t('mobile.add.cancel')} secondary onPress={onClose} />
              )}
            </View>
          )}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={styles.content}
          >
            {children}
            {bottomCancel && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('mobile.add.cancel')}
                onPress={onClose}
                style={({ pressed }) => [
                  styles.cancel,
                  {
                    borderColor: colors.chip,
                    opacity: pressed ? m.pressedOpacity : 1,
                  },
                ]}
              >
                <Text style={[styles.cancelText, { color: colors.ink2 }]}>
                  {t('mobile.add.cancel')}
                </Text>
              </Pressable>
            )}
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
    gap: m.space.sm,
    paddingBottom: m.space.sm,
  },
  title: { flex: 1, fontFamily: m.fontBold, fontSize: m.type.heading },
  cancel: {
    minHeight: m.height.field,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: m.border,
    borderRadius: m.radius.field,
    marginTop: m.space.lg,
  },
  cancelText: { fontFamily: m.fontMedium, fontSize: m.type.body },
  content: { gap: m.space.sm, paddingBottom: m.space.lg },
});
