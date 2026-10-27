import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SPROUT_BODY, SPROUT_LEAVES, SPROUT_CHECK, SPROUT_DASH, checkColor } from '@nodii/core';
import { metrics as m, useHighContrast, useReducedMotion, useTheme } from '../../lib/theme';

/** 두 행 렌더러가 같은 싹이와 모션·접근성 외곽선을 공유한다 (TODO-02, ROUT-05). */
export function SproutCheck({
  color,
  done = false,
  skipped = false,
}: {
  color: string;
  done?: boolean;
  skipped?: boolean;
}) {
  const { colors } = useTheme();
  const highContrast = useHighContrast();
  const reduced = useReducedMotion();
  const [pop] = useState(() => new Animated.Value(1));
  useEffect(() => {
    pop.stopAnimation();
    if (!done || reduced) {
      pop.setValue(1);
      return;
    }
    pop.setValue(0);
    const animation = Animated.timing(pop, {
      toValue: 1,
      duration: m.motion.check,
      easing: Easing.bezier(0.2, 0.9, 0.3, 1.35),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [done, reduced, pop]);
  return (
    <View accessible={false} style={styles.frame}>
      <Svg width={m.glyph.check} height={m.glyph.check} viewBox="0 0 24 24">
        <Path
          testID="sprout-body"
          d={SPROUT_BODY}
          fill={done ? color : colors.box}
          stroke={!done && highContrast ? colors.muted : 'none'}
          strokeWidth={1.4}
        />
        {!done && skipped && (
          <Path
            testID="sprout-dash"
            d={SPROUT_DASH}
            fill="none"
            stroke={colors.muted}
            strokeWidth={2.7}
            strokeLinecap="round"
          />
        )}
      </Svg>
      {done && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { transform: [{ scale: pop }] }]}
        >
          <Svg width={m.glyph.check} height={m.glyph.check} viewBox="0 0 24 24">
            <Path testID="sprout-leaves" d={SPROUT_LEAVES} fill={color} />
            <Path
              testID="sprout-check"
              d={SPROUT_CHECK}
              fill="none"
              stroke={checkColor(color)}
              strokeWidth={2.7}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({ frame: { width: m.glyph.check, height: m.glyph.check } });
