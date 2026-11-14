import {
  shouldShowFirstPublishNotice,
  type DefaultVisibility,
  type GoalVisibility,
} from '@nodii/core';
import { t } from '@nodii/i18n';
import { toast } from 'sonner';

const key = 'nodii:first-publish-notice';
let seen = false;

/** SOC-25·28: 편집과 기본값 화면에서 기기당 한 번만 알린다. */
export function showPublishNotice(prev: GoalVisibility, next: DefaultVisibility) {
  if (seen) return;
  try {
    seen = localStorage.getItem(key) === '1';
  } catch {
    /* 메모리 표시를 유지한다. */
  }
  if (!shouldShowFirstPublishNotice(prev, next, seen)) return;
  seen = true;
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* 현재 실행에서는 반복하지 않는다. */
  }
  toast(t('social.visibility.notice'));
}
