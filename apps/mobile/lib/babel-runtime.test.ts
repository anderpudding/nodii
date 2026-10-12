// @vitest-environment node
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

it.each([
  '../../../package.json',
  '../../../apps/desktop/package.json',
  '../../../apps/mobile/package.json',
  '../../../packages/core/src/day.ts',
  '../../../packages/api/src/client.ts',
  '../../../packages/i18n/src/translate.ts',
])('Babel 헬퍼를 변환할 파일 위치 %s에서 직접 해석한다 (MOB-01)', (path) => {
  // Jest의 캐시나 실행 래퍼가 넣은 NODE_PATH에 의존하지 않는 Node 해석 경로를 검증한다.
  const requireFromSource = createRequire(new URL(path, import.meta.url));
  for (const helper of ['interopRequireDefault', 'interopRequireWildcard']) {
    expect(requireFromSource.resolve(`@babel/runtime/helpers/${helper}`)).toEqual(
      expect.any(String),
    );
  }
});
