import { SheetHeader } from '../../components/SheetHeader';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleSheet, Text, View } from 'react-native';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';

export const GUIDE_KEY = 'nodii.gesture-guide:1';

/** MOB-01: 첫 로그인 뒤 기기에서 한 번만 안내하고 모든 닫기 경로를 건너뛰기로 저장한다. */
export function FirstRunGuide() {
  const [visible, setVisible] = useState(false);
  const { colors } = useTheme();
  const toast = useToast();
  useEffect(() => {
    let live = true;
    void AsyncStorage.getItem(GUIDE_KEY).then(
      (seen) => {
        if (live) setVisible(seen !== 'seen');
      },
      () => {
        if (!live) return;
        setVisible(true);
        toast(() => t('mobile.guide.storageFailed'));
      },
    );
    return () => {
      live = false;
    };
  }, [toast]);
  function close() {
    setVisible(false);
    void AsyncStorage.setItem(GUIDE_KEY, 'seen').catch(() =>
      toast(() => t('mobile.guide.storageFailed')),
    );
  }
  if (!visible) return null;
  return (
    <BottomSheet
      title={t('mobile.guide.title')}
      testID="first-run-guide"
      onClose={close}
      header={
        <SheetHeader
          title={t('mobile.guide.title')}
          headerStyle={styles.header}
          titleStyle={[styles.title, { color: colors.ink }]}
          trailing={<Button secondary label={t('mobile.guide.skip')} onPress={close} />}
        />
      }
    >
      <View style={styles.lesson}>
        <Text style={[styles.heading, { color: colors.ink }]}>{t('mobile.guide.swipe')}</Text>
        <Text style={[styles.body, { color: colors.ink2 }]}>
          {t('mobile.guide.swipeDescription')}
        </Text>
      </View>
      <View style={[styles.lesson, { borderTopWidth: m.border, borderColor: colors.line }]}>
        <Text style={[styles.heading, { color: colors.ink }]}>{t('mobile.guide.hold')}</Text>
        <Text style={[styles.body, { color: colors.ink2 }]}>
          {t('mobile.guide.holdDescription')}
        </Text>
      </View>
      <Button label={t('mobile.guide.done')} onPress={close} />
    </BottomSheet>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: m.space.sm },
  title: { flex: 1, fontFamily: m.fontBold, fontSize: m.type.heading },
  heading: { fontFamily: m.fontSemiBold, fontSize: m.type.body },
  body: {
    fontFamily: m.fontFamily,
    fontSize: m.type.body,
    lineHeight: m.type.body * m.lineHeight.body,
  },
  lesson: { paddingVertical: m.space.lg, gap: m.space.sm },
});
