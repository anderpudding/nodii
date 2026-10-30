import { getLocale } from '@nodii/i18n';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { metrics as m, useReducedMotion, useTheme } from '../../../lib/theme';
import { createRowCoordinator, swipeOutcome, swipeRules } from './swipe';
import { ActionIcon } from '../ActionIcon';

export interface RowAction {
  id: string;
  label: string;
  visualLabel?: string;
  background: string;
  color: string;
  run(): void;
}
const SwipeContext = createContext<{
  coordinator: ReturnType<typeof createRowCoordinator>;
  scroll: ReturnType<typeof Gesture.Native>;
} | null>(null);
/** 가상화된 목록에서도 열린 행은 하나만 유지한다 (MOB-01). */
export function SwipeRows({ children }: { children: ReactNode }) {
  const coordinator = useMemo(() => createRowCoordinator(), []);
  const scroll = useMemo(() => Gesture.Native(), []);
  return (
    <SwipeContext.Provider value={{ coordinator, scroll }}>
      <GestureDetector gesture={scroll}>{children}</GestureDetector>
    </SwipeContext.Provider>
  );
}
/** 향후 루틴/목표도 같은 거리 판정과 스크롤 양보 규칙을 사용한다. */
export function SwipeableRow({
  id,
  disabled,
  leading,
  trailing,
  onMenu,
  onUnavailableSwipe,
  onReorder,
  children,
}: {
  id: string;
  disabled: boolean;
  leading?: RowAction;
  trailing: RowAction[];
  onMenu(): void;
  onUnavailableSwipe?(): void;
  onReorder?(distance: number): void;
  children: ReactNode;
}) {
  const context = useContext(SwipeContext);
  const coordinator = context?.coordinator;
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const offset = useSharedValue(0);
  const start = useSharedValue(0);
  const width = useSharedValue(0);
  const scale = useSharedValue(1);
  const vertical = useSharedValue(0);
  const [dragging, setDragging] = useState(false);
  const [opened, setOpened] = useState(false);
  const actionWidth = m.height.chip * 2;
  const railWidth = trailing.length * actionWidth;
  const hasLeading = leading !== undefined;
  const duration = reduced ? 0 : m.motion.state;
  const close = useCallback(() => {
    offset.set(withTiming(0, { duration }));
    setOpened(false);
  }, [offset, duration]);
  useEffect(() => () => coordinator?.release(id), [coordinator, id]);
  useEffect(() => {
    if (disabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 네이티브 제스처를 잠글 때 열린 칸과 접근성 상태도 함께 닫는다.
      close();
      coordinator?.release(id);
    }
  }, [disabled, close, coordinator, id]);
  function activate() {
    coordinator?.activate(id, close);
  }
  function settle(outcome: ReturnType<typeof swipeOutcome>) {
    setOpened(outcome === 'open');
    if (outcome === 'leading') leading?.run();
    if (outcome === 'trailing') trailing[trailing.length - 1]?.run();
    if (outcome !== 'open') coordinator?.release(id);
  }
  function feedback() {
    // 진동 불가/시뮬레이터에서도 메뉴는 계속 쓸 수 있다. 데이터 쓰기 오류와 별개다.
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
  const pan = Gesture.Pan()
    .withTestId(`swipe-${id}`)
    .enabled(!disabled)
    .activeOffsetX([-swipeRules.horizontalActivation, swipeRules.horizontalActivation])
    .failOffsetY([-swipeRules.verticalFailure, swipeRules.verticalFailure])
    .onStart(() => {
      start.set(offset.get());
      scheduleOnRN(activate);
    })
    .onUpdate((event) => {
      if (railWidth === 0 && event.translationX < 0) {
        offset.set(0);
        return;
      }
      offset.set(
        Math.max(
          -width.get(),
          Math.min(hasLeading ? width.get() : 0, start.get() + event.translationX),
        ),
      );
    })
    .onEnd((event) => {
      if (railWidth === 0 && event.translationX < -swipeRules.horizontalActivation) {
        offset.set(0);
        if (onUnavailableSwipe) scheduleOnRN(onUnavailableSwipe);
        return;
      }
      // 빠른 밀기는 update 없이 끝날 수 있으므로 최종 네이티브 이동 거리로 판정한다.
      const result = swipeOutcome(
        Math.min(hasLeading ? width.get() : 0, start.get() + event.translationX),
        width.get(),
        railWidth,
      );
      offset.set(withTiming(result === 'open' ? -railWidth : 0, { duration }));
      scheduleOnRN(settle, result);
    })
    .onFinalize((_event, success) => {
      if (!success) {
        offset.set(withTiming(0, { duration }));
        scheduleOnRN(close);
      }
    });
  const longPress = Gesture.LongPress()
    .withTestId(`hold-${id}`)
    .enabled(!disabled)
    .minDuration(swipeRules.longPressMs)
    .maxDistance(swipeRules.verticalFailure)
    .onStart(() => {
      scale.set(
        withTiming(reduced ? 1 : m.longPressScale, { duration: reduced ? 0 : m.motion.press }),
      );
      scheduleOnRN(activate);
      scheduleOnRN(feedback);
    })
    .onEnd((_event, success) => {
      if (success) scheduleOnRN(onMenu);
    })
    .onFinalize(() => {
      scale.set(withTiming(1, { duration: reduced ? 0 : m.motion.press }));
      scheduleOnRN(close);
    });
  const reorder = Gesture.Pan()
    .withTestId(`reorder-${id}`)
    .enabled(!disabled && !!onReorder)
    .activateAfterLongPress(swipeRules.longPressMs)
    .onStart(() => {
      scheduleOnRN(activate);
      scheduleOnRN(feedback);
      scheduleOnRN(setDragging, true);
      scale.set(reduced ? 1 : m.longPressScale);
    })
    .onUpdate((event) => {
      vertical.set(event.translationY);
    })
    .onEnd((event) => {
      if (Math.abs(event.translationY) < m.space.md) scheduleOnRN(onMenu);
      else if (onReorder) scheduleOnRN(onReorder, event.translationY);
    })
    .onFinalize(() => {
      vertical.set(0);
      scale.set(1);
      scheduleOnRN(setDragging, false);
    });
  if (context) {
    pan.simultaneousWithExternalGesture(context.scroll);
    longPress.simultaneousWithExternalGesture(context.scroll);
    if (onReorder) reorder.blocksExternalGesture(context.scroll);
  }
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offset.get() },
      { translateY: vertical.get() },
      { scale: scale.get() },
    ],
  }));
  const leadingStyle = useAnimatedStyle(() => ({ opacity: offset.get() > 0 ? 1 : 0 }));
  const trailingStyle = useAnimatedStyle(() => ({ opacity: offset.get() < 0 ? 1 : 0 }));
  return (
    <View
      testID={`swipe-layout-${id}`}
      style={[styles.clip, dragging && { overflow: 'visible', zIndex: 1 }]}
      onLayout={(event) => {
        width.set(event.nativeEvent.layout.width);
      }}
    >
      {leading && (
        <Animated.View
          pointerEvents="none"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.leading, leadingStyle, { backgroundColor: leading.background }]}
        >
          <View style={[styles.leadingContent, { width: actionWidth }]}>
            <ActionIcon action={leading.id} color={leading.color} />
            <Text
              numberOfLines={getLocale() === 'en' ? 1 : undefined}
              adjustsFontSizeToFit={getLocale() === 'en'}
              style={[styles.label, { color: leading.color }]}
            >
              {leading.visualLabel ?? leading.label}
            </Text>
          </View>
        </Animated.View>
      )}
      <Animated.View
        accessibilityElementsHidden={disabled || !opened}
        importantForAccessibility={!disabled && opened ? 'auto' : 'no-hide-descendants'}
        pointerEvents={!disabled && opened ? 'auto' : 'none'}
        style={[styles.trailing, trailingStyle]}
      >
        {trailing.map((action) => (
          <Pressable
            key={action.id}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            disabled={disabled}
            onPress={() => {
              close();
              coordinator?.release(id);
              action.run();
            }}
            style={({ pressed }) => [
              styles.cell,
              {
                width: actionWidth,
                backgroundColor: action.background,
                opacity: pressed ? m.pressedOpacity : 1,
              },
            ]}
          >
            <ActionIcon action={action.id} color={action.color} />
            <Text
              numberOfLines={getLocale() === 'en' ? 1 : undefined}
              adjustsFontSizeToFit={getLocale() === 'en'}
              style={[styles.label, { color: action.color }]}
            >
              {action.visualLabel ?? action.label}
            </Text>
          </Pressable>
        ))}
      </Animated.View>
      <GestureDetector gesture={Gesture.Race(pan, onReorder ? reorder : longPress)}>
        <Animated.View style={[{ backgroundColor: colors.bg }, animatedStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
const styles = StyleSheet.create({
  clip: { overflow: 'hidden', borderRadius: m.radius.field },
  leading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  leadingContent: { alignItems: 'center', justifyContent: 'center', gap: m.space.xs },
  trailing: { position: 'absolute', top: 0, bottom: 0, right: 0, flexDirection: 'row' },
  cell: {
    minHeight: m.height.field,
    justifyContent: 'center',
    alignItems: 'center',
    gap: m.space.xs,
  },
  label: { fontFamily: m.fontExtraBold, fontSize: m.type.button },
});
