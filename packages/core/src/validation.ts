import { TITLE_MAX_LENGTH } from './constants';

/** 빈 제목과 저장 한도를 넘는 제목을 입력 단계에서 거른다 (TODO-01). */
export function normalizeTitle(value: string): string | null {
  const title = value.trim();
  return title.length >= 1 && title.length <= TITLE_MAX_LENGTH ? title : null;
}

/** 축약형이나 알파 채널 없는 DB 색상 형식만 허용한다 (GOAL-03). */
export function isHexColor(value: string): boolean {
  return value.length === 7 && /^#[0-9a-fA-F]{6}$/.test(value);
}

/** 유효한 색상을 대문자로 통일하고 잘못된 입력은 null로 알린다. */
export function normalizeHexColor(value: string): string | null {
  return isHexColor(value) ? value.toUpperCase() : null;
}
