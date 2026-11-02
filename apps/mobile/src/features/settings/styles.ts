import { StyleSheet } from 'react-native';
import { metrics as m } from '../../../lib/theme';
export const settingsStyles = StyleSheet.create({
  group: { gap: m.space.sm },
  card: { borderRadius: m.radius.card, borderWidth: 0, overflow: 'hidden' },
  // 마지막 줄의 아래 구분선을 카드 밖으로 밀어 잘라 낸다.
  rows: { marginBottom: -m.border },
  row: {
    paddingHorizontal: m.space.lg,
    paddingVertical: m.space.sm,
    gap: m.space.sm,
    minHeight: m.height.field,
    borderBottomWidth: m.border,
  },
  horizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: m.space.sm,
  },
  // 긴 영어 값은 다음 줄로 내리되, 한 줄일 때 값이 위로 붙지 않고 줄 가운데에 오게 한다.
  wrap: { flexWrap: 'wrap', alignContent: 'center', columnGap: m.space.md, rowGap: m.space.sm },
  body: { fontFamily: m.fontFamily, fontSize: m.type.body },
  label: {
    fontFamily: m.fontExtraBold,
    fontSize: m.type.supporting,
    paddingHorizontal: m.space.xs,
  },
  supporting: {
    fontFamily: m.fontMedium,
    fontSize: m.type.supporting,
    lineHeight: m.type.supporting * m.lineHeight.body,
  },
  note: { paddingHorizontal: m.space.lg, paddingVertical: m.space.sm },
  segment: {
    flexDirection: 'row',
    flexShrink: 1,
    marginLeft: 'auto',
    padding: m.space.xs,
    borderRadius: m.radius.pill,
  },
  segmentOption: {
    minHeight: m.height.chip,
    minWidth: m.height.touch,
    paddingHorizontal: m.space.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: m.radius.pill,
  },
  segmentLabel: { fontFamily: m.fontExtraBold, fontSize: m.type.button },
});
