import type { ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { getLocale } from '@nodii/i18n';
import { useLargeEnglishText } from '../../lib/use-large-english-text';
import { metrics as m } from '../../lib/theme';

/** SET-06: 확대 영어 제목과 동작이 폭을 다투지 않게 하고 한국어 원래 행은 보존한다. */
export function SheetHeader({
  title,
  leading,
  trailing,
  headerStyle,
  titleStyle,
}: {
  title: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  headerStyle: StyleProp<ViewStyle>;
  titleStyle: StyleProp<TextStyle>;
}) {
  const stacked = useLargeEnglishText();
  const largeTitle = { ...StyleSheet.flatten(titleStyle) };
  delete largeTitle.flex;
  const heading = (
    <Text
      accessibilityRole="header"
      numberOfLines={getLocale() === 'en' ? 2 : undefined}
      adjustsFontSizeToFit={getLocale() === 'en'}
      style={stacked ? largeTitle : titleStyle}
    >
      {title}
    </Text>
  );
  if (!stacked)
    return (
      <View style={headerStyle}>
        {leading}
        {heading}
        {trailing}
      </View>
    );
  return (
    <View style={[headerStyle, { flexDirection: 'column', alignItems: 'stretch' }]}>
      {heading}
      {(leading || trailing) && (
        <View style={{ flexDirection: 'row', gap: m.space.sm }}>
          <View style={{ flex: 1 }}>{leading}</View>
          <View style={{ flex: 1 }}>{trailing}</View>
        </View>
      )}
    </View>
  );
}
