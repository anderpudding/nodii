import { Pressable, Text, useWindowDimensions } from 'react-native';
import { metrics as m, useTheme } from '../../../lib/theme';
import { SocialIcon } from '../social/Primitives';
import { settingsStyles as s } from './styles';

/** 설정의 하위 화면 링크는 값과 화살표를 항상 이름 오른쪽에 둔다. */
export function SettingsLinkRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress(): void;
}) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityValue={{ text: value }}
      onPress={onPress}
      style={({ pressed }) => [
        s.row,
        s.horizontal,
        { borderBottomColor: colors.line, opacity: pressed ? m.pressedOpacity : 1 },
      ]}
    >
      <Text numberOfLines={fontScale > 1 ? 2 : 1} style={[s.body, { color: colors.ink, flex: 1 }]}>
        {label}
      </Text>
      <Text style={[s.supporting, { color: colors.muted, flexShrink: 0, maxWidth: '50%' }]}>
        {value}
      </Text>
      <SocialIcon name="chevronRight" color={colors.muted} size={20} />
    </Pressable>
  );
}
