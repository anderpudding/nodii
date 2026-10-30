import { t, withParticle } from '@nodii/i18n';

export type RoutineToastKey =
  'todo.toggled' | 'todo.untoggled' | 'routine.skipped' | 'routine.unskipped';

/** ROUT-05/07: 할 일과 같은 조사 규칙으로 루틴 토스트의 말투를 맞춘다. */
export function routineToastMessage(key: RoutineToastKey, title: string) {
  return t(key, {
    title,
    particle: withParticle(title).slice(title.length),
  });
}
