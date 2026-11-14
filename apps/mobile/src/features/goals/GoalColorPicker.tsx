import { useState } from 'react';
import { AccessibilityInfo, Text, TextInput, View, type GestureResponderEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { hexToHsv, hsvToHex, normalizeHex, type Hsv } from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { routineStyles as s } from '../routines/styles';

const rainbow = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000'];
const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** SOC-27: 색 선택을 적용하기 전까지 편집 화면의 색을 유지한다. */
export function GoalColorPicker({
  initial,
  onApply,
  onClose,
}: {
  initial: string;
  onApply(color: string): void;
  onClose(): void;
}) {
  const { colors } = useTheme();
  const [hsv, setHsv] = useState(() => hexToHsv(initial));
  const [hex, setHex] = useState(initial);
  const [width, setWidth] = useState(1);
  const color = hsvToHex(hsv);
  const height = 220;
  const apply = (next: Hsv) => {
    setHsv(next);
    setHex(hsvToHex(next));
  };
  const sv = (event: GestureResponderEvent) =>
    apply({
      ...hsv,
      s: clamp(event.nativeEvent.locationX / width),
      v: 1 - clamp(event.nativeEvent.locationY / height),
    });
  const hue = (event: GestureResponderEvent) =>
    apply({ ...hsv, h: clamp(event.nativeEvent.locationX / width) * 359 });
  const adjust = (field: keyof Hsv, delta: number) => {
    const next = {
      ...hsv,
      [field]: field === 'h' ? (hsv.h + delta * 10 + 360) % 360 : clamp(hsv[field] + delta * 0.05),
    };
    apply(next);
    AccessibilityInfo.announceForAccessibility(hsvToHex(next));
  };
  const knob = {
    position: 'absolute' as const,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: color,
    transform: [{ translateX: -12 }, { translateY: -12 }],
  };
  return (
    <BottomSheet
      title={t('goal.colorPicker.title')}
      testID="goal-color-picker"
      keyboard
      onClose={onClose}
      header={
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Button label={t('mobile.add.cancel')} onPress={onClose} quiet secondary />
          <Text style={[s.label, { color: colors.ink }]}>{t('goal.colorPicker.title')}</Text>
        </View>
      }
    >
      <View
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('goal.colorPicker.sv')}
        accessibilityActions={[
          { name: 'increment' },
          { name: 'decrement' },
          { name: 'increaseSaturation', label: t('goal.colorPicker.saturationUp') },
          { name: 'decreaseSaturation', label: t('goal.colorPicker.saturationDown') },
        ]}
        onAccessibilityAction={(event) => {
          const action = event.nativeEvent.actionName;
          adjust(
            action.endsWith('Saturation') ? 's' : 'v',
            action === 'increment' || action === 'increaseSaturation' ? 1 : -1,
          );
        }}
        onStartShouldSetResponder={() => true}
        onResponderGrant={sv}
        onResponderMove={sv}
        style={{
          height,
          borderRadius: m.radius.field,
          backgroundColor: hsvToHex({ h: hsv.h, s: 1, v: 1 }),
        }}
      >
        <View pointerEvents="none" style={{ borderRadius: m.radius.field, overflow: 'hidden' }}>
          <Svg width="100%" height={height}>
            <Defs>
              <LinearGradient id="sat" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop stopColor="#FFFFFF" />
                <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
              <LinearGradient id="val" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop stopColor="#000000" stopOpacity={0} />
                <Stop offset="100%" stopColor="#000000" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#sat)" />
            <Rect width="100%" height="100%" fill="url(#val)" />
          </Svg>
        </View>
        <View
          pointerEvents="none"
          style={[knob, { left: hsv.s * width, top: (1 - hsv.v) * height }]}
        />
      </View>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('goal.colorPicker.hue')}
        accessibilityValue={{ min: 0, max: 359, now: Math.floor(hsv.h) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) =>
          adjust('h', event.nativeEvent.actionName === 'increment' ? 1 : -1)
        }
        onStartShouldSetResponder={() => true}
        onResponderGrant={hue}
        onResponderMove={hue}
        style={{ minHeight: m.height.touch, justifyContent: 'center' }}
      >
        <View pointerEvents="none" style={{ borderRadius: m.radius.pill, overflow: 'hidden' }}>
          <Svg width="100%" height={24}>
            <Defs>
              <LinearGradient id="hue" x1="0%" y1="0%" x2="100%" y2="0%">
                {rainbow.map((value, index) => (
                  <Stop key={index} offset={index / 6} stopColor={value} />
                ))}
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#hue)" />
          </Svg>
        </View>
        <View
          pointerEvents="none"
          style={[knob, { left: (hsv.h / 359) * width, top: m.height.touch / 2 }]}
        />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: m.space.md }}>
        <View
          accessible
          accessibilityLabel={t('goal.colorPicker.preview', { color })}
          testID="goal-color-preview"
          style={{
            width: m.height.touch,
            height: m.height.touch,
            borderRadius: m.radius.pill,
            backgroundColor: color,
          }}
        />
        <TextInput
          accessibilityLabel={t('goal.hex')}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={7}
          value={hex}
          onChangeText={(value) => {
            setHex(value);
            const normalized = normalizeHex(value);
            if (normalized) setHsv(hexToHsv(normalized));
          }}
          style={[
            s.input,
            { flex: 1, backgroundColor: colors.chip, color: colors.ink, borderColor: colors.line },
          ]}
        />
      </View>
      {!normalizeHex(hex) && (
        <Text accessibilityRole="alert" style={{ color: colors.danger }}>
          {t('goal.hex.invalid')}
        </Text>
      )}
      <Button
        label={t('goal.colorPicker.apply')}
        disabled={!normalizeHex(hex)}
        onPress={() => onApply(color)}
      />
    </BottomSheet>
  );
}
