import { StyleSheet } from 'react-native';
import { metrics as m } from '../../../lib/theme';

// 기존 토큰을 사용하는 루틴 편집·범위 화면의 공통 배치.
export const routineStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: m.space.sm,
    paddingBottom: m.space.lg,
  },
  heading: { flex: 1, fontFamily: m.fontBold, fontSize: m.type.heading, textAlign: 'center' },
  group: { gap: m.space.sm, marginBottom: m.space.lg },
  label: { fontFamily: m.fontBold, fontSize: m.type.supporting },
  supporting: {
    fontFamily: m.fontMedium,
    fontSize: m.type.supporting,
    lineHeight: m.type.supporting * m.lineHeight.body,
  },
  input: {
    minHeight: m.height.field,
    fontFamily: m.fontFamily,
    fontSize: m.type.body,
    padding: m.space.lg,
    borderWidth: m.selectionRing,
    borderRadius: m.radius.field,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: m.space.sm },
  segment: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: m.space.sm,
    padding: m.space.xs,
    borderRadius: m.radius.field,
  },
  period: { borderWidth: m.border, borderRadius: m.radius.field, overflow: 'hidden' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: m.space.lg },
});
