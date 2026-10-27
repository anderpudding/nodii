import { StyleSheet } from 'react-native';
import { metrics as m } from '../../../lib/theme';
export const settingsStyles = StyleSheet.create({
  group: { gap: m.space.sm },
  card: { borderRadius: m.radius.card, borderWidth: 0, overflow: 'hidden' },
  row: {
    padding: m.space.lg,
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
  body: { fontFamily: m.fontFamily, fontSize: m.type.body },
  label: { fontFamily: m.fontExtraBold, fontSize: m.type.supporting },
  supporting: {
    fontFamily: m.fontMedium,
    fontSize: m.type.supporting,
    lineHeight: m.type.supporting * m.lineHeight.body,
  },
  segment: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: m.space.sm,
    padding: m.space.xs,
    borderRadius: m.radius.pill,
  },
});
