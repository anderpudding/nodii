import type { Profile } from '@nodii/core';
import type { Database } from './database.types';

/** DB 열 이름을 도메인 이름으로 변환하는 유일한 경계다. */
export function mapProfile(row: Database['public']['Tables']['profiles']['Row']): Profile {
  if (row.week_start !== 0 && row.week_start !== 1)
    throw new Error('지원하지 않는 주 시작 요일입니다.');
  return {
    id: row.id,
    displayName: row.display_name,
    timezone: row.timezone,
    weekStart: row.week_start,
  };
}
