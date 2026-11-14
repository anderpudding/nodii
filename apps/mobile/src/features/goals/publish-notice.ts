import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  shouldShowFirstPublishNotice,
  type DefaultVisibility,
  type GoalVisibility,
} from '@nodii/core';
import { t } from '@nodii/i18n';

const key = 'nodii:first-publish-notice';
let seen = false;
let queue = Promise.resolve();

/** SOC-25·28: 같은 기기의 편집과 기본값 화면이 한 번만 알린다. */
export function showPublishNotice(
  prev: GoalVisibility,
  next: DefaultVisibility,
  notify: (message: () => string) => void,
) {
  if (!shouldShowFirstPublishNotice(prev, next, seen)) return;
  queue = queue.then(async () => {
    if (seen) return;
    seen = (await AsyncStorage.getItem(key).catch(() => null)) === '1';
    if (seen) return;
    seen = true;
    notify(() => t('social.visibility.notice'));
    await AsyncStorage.setItem(key, '1').catch(() => {});
  });
}
