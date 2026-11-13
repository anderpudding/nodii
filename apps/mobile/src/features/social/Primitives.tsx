import { createContext, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { socialIcons, SPROUT_BODY, SPROUT_LEAVES } from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';

export const tabInset = 66;
export const TodayVisible = createContext(true);
export const profileStyles = StyleSheet.create({
  fill: { flex: 1 },
  page: { paddingHorizontal: m.space.lg, flexGrow: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: m.space.md },
  title: {
    fontFamily: m.fontExtraBold,
    fontSize: m.type.title,
    letterSpacing: m.letterSpacing.title,
  },
  heading: { fontFamily: m.fontExtraBold, fontSize: m.type.heading },
  body: {
    fontFamily: m.fontFamily,
    fontSize: m.type.body,
    lineHeight: m.type.body * m.lineHeight.body,
  },
  support: {
    fontFamily: m.fontMedium,
    fontSize: m.type.supporting,
    lineHeight: m.type.supporting * m.lineHeight.body,
  },
  label: { fontFamily: m.fontBold, fontSize: m.type.label },
  row: { flexDirection: 'row', alignItems: 'center', gap: m.space.sm },
  card: { borderRadius: m.radius.card, overflow: 'hidden' },
});

/** D13: 모든 소셜 글리프에 기존 선 아이콘 규칙을 적용한다. */
export function SocialIcon({
  name,
  color,
  size = 24,
}: {
  name: keyof typeof socialIcons;
  color: string;
  size?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessible={false}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d={socialIcons[name]} />
    </Svg>
  );
}

/** D23: 원형 사진이 없거나 실패하면 같은 무채색 싹이를 표시한다. */
export function Avatar({
  photoUrl,
  size,
  selected,
  label,
}: {
  photoUrl?: string;
  size: number;
  selected?: boolean;
  label: string;
}) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState<string>();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.chip,
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: selected ? `0 0 0 2.5px ${colors.bg}, 0 0 0 4.5px ${colors.ink}` : undefined,
      }}
    >
      {photoUrl && failed !== photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          onError={() => setFailed(photoUrl)}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <Svg
          width={size * 0.62}
          height={size * 0.62}
          viewBox="0 0 24 24"
          style={{ transform: [{ translateY: size * 0.04 }] }}
        >
          <Path d={SPROUT_BODY} fill={colors.avatarSeed} />
          <Path d={SPROUT_LEAVES} fill={colors.avatarLeaf} />
        </Svg>
      )}
    </View>
  );
}

/** S2: 하위 화면의 뒤로·제목·완료 위치를 같은 헤더로 맞춘다. */
export function ProfileNav({
  back,
  onBack,
  title,
  onDone,
  disabled,
  busy,
  doneLabel,
}: {
  back: string;
  onBack(): void;
  title?: string;
  onDone?: () => void;
  disabled?: boolean;
  busy?: boolean;
  doneLabel?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        profileStyles.row,
        { minHeight: 48, paddingHorizontal: m.space.lg, justifyContent: 'space-between' },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={back}
        onPress={onBack}
        disabled={busy}
        style={{ minHeight: m.height.touch, flex: 1, justifyContent: 'center' }}
      >
        <Text numberOfLines={1} style={[profileStyles.support, { color: colors.ink2 }]}>
          {back}
        </Text>
      </Pressable>
      {title && (
        <Text
          accessibilityRole="header"
          style={[profileStyles.heading, { color: colors.ink, textAlign: 'center' }]}
        >
          {title}
        </Text>
      )}
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        {onDone && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={doneLabel ?? t('social.done')}
            accessibilityState={{ disabled, busy }}
            disabled={disabled || busy}
            onPress={onDone}
            style={{
              minHeight: m.height.touch,
              minWidth: m.height.touch,
              justifyContent: 'center',
              alignItems: 'flex-end',
            }}
          >
            {busy ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <Text
                style={[profileStyles.heading, { color: disabled ? colors.muted : colors.ink }]}
              >
                {t('social.done')}
              </Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** D27: 같은 원형 터치 영역을 프로필 도구에 재사용한다. */
export function ProfileTool({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress(): void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? m.pressedOpacity : 1,
      })}
    >
      {children}
    </Pressable>
  );
}
