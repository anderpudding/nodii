import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'nodii-version-'));
  const files = {
    'apps/desktop/src-tauri/tauri.conf.json': { version: '0.1.0' },
    'apps/desktop/package.json': { version: '0.1.0' },
    'apps/mobile/app.json': { expo: { version: '0.1.0', ios: { buildNumber: '7' } } },
    'apps/mobile/package.json': { version: '0.1.0' },
  };
  try {
    mkdirSync(join(root, 'scripts'), { recursive: true });
    copyFileSync(
      new URL('./bump-version.sh', import.meta.url),
      join(root, 'scripts/bump-version.sh'),
    );
    for (const [file, value] of Object.entries(files)) {
      mkdirSync(join(root, file, '..'), { recursive: true });
      writeFileSync(join(root, file), JSON.stringify(value, null, 2) + '\n');
    }
    run(root, files);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
function bump(root, ...args) {
  return spawnSync('bash', [join(root, 'scripts/bump-version.sh'), ...args], { encoding: 'utf8' });
}
function read(root, file) {
  return JSON.parse(readFileSync(join(root, file), 'utf8'));
}
test('같은 버전 선택은 두 플랫폼을 맞추고 iOS 원격 빌드 번호를 건드리지 않는다', () =>
  fixture((root, files) => {
    assert.equal(bump(root, '0.2.0', '--platform', 'all').status, 0);
    for (const file of Object.keys(files)) {
      const value = read(root, file);
      assert.equal(value.expo?.version ?? value.version, '0.2.0');
    }
    assert.equal(read(root, 'apps/mobile/app.json').expo.ios.buildNumber, '7');
  }));
test('iOS 전용 선택은 macOS 버전/태그 안내를 바꾸지 않는다', () =>
  fixture((root) => {
    const result = bump(root, '0.2.0', '--platform', 'ios');
    assert.equal(result.status, 0);
    assert.equal(read(root, 'apps/desktop/package.json').version, '0.1.0');
    assert.equal(read(root, 'apps/mobile/app.json').expo.version, '0.2.0');
    assert.ok(!result.stdout.includes('git tag v0.2.0'));
  }));
test('기존 인자 하나는 macOS 버전만 올린다', () =>
  fixture((root) => {
    assert.equal(bump(root, '0.2.0').status, 0);
    assert.equal(read(root, 'apps/desktop/package.json').version, '0.2.0');
    assert.equal(read(root, 'apps/mobile/package.json').version, '0.1.0');
  }));
test('잘못된 인자나 손상 파일은 어떤 버전도 먼저 쓰지 않는다', () =>
  fixture((root) => {
    assert.notEqual(bump(root, '01.2.0', '--platform', 'all').status, 0);
    assert.notEqual(bump(root, '0.2.0', '--platform', 'invalid').status, 0);
    writeFileSync(join(root, 'apps/mobile/app.json'), '{}');
    assert.notEqual(bump(root, '0.2.0', '--platform', 'all').status, 0);
    assert.equal(read(root, 'apps/desktop/package.json').version, '0.1.0');
    assert.equal(read(root, 'apps/mobile/package.json').version, '0.1.0');
  }));
