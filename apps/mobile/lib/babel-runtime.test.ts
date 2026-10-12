// @vitest-environment node
import { execFileSync } from 'node:child_process';
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
  const output = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { createRequire } from 'node:module';
       const requireFromSource = createRequire(process.argv[1]);
       console.log(JSON.stringify(['interopRequireDefault', 'interopRequireWildcard']
         .map(helper => requireFromSource.resolve('@babel/runtime/helpers/' + helper))));`,
      new URL(path, import.meta.url).href,
    ],
    { encoding: 'utf8', env: { ...process.env, NODE_PATH: '' } },
  );
  expect(JSON.parse(output)).toEqual([expect.any(String), expect.any(String)]);
});
