import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    // .gitignore와 동일하게 로컬 설치 에이전트 도구는 제품 코드 검사에서 제외한다.
    '.agents/',
    '.claude/',
    '.codex/',
    '.github/agents/',
    '.github/hooks/',
    '.github/skills/',
    '**/node_modules',
    '**/dist',
    '**/coverage',
    '**/src-tauri/target',
    '**/src-tauri/gen',
    'packages/api/src/database.types.ts',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['apps/desktop/src/**/*.{ts,tsx}', 'apps/mobile/{app,src}/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['apps/desktop/src/**/*.{ts,tsx}', 'apps/mobile/{app,src,lib}/**/*.{ts,tsx}'],
    ignores: [
      '**/*.test.*',
      'apps/desktop/src/test/**',
      'apps/mobile/src/test/**',
      'apps/mobile/lib/test-setup.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...[
          'Literal[value=/[가-힣]/]',
          'TemplateElement[value.raw=/[가-힣]/]',
          'JSXText[value=/[가-힣]/]',
        ].map((selector) => ({
          selector,
          message: 'UI 문구는 @nodii/i18n 카탈로그에 넣고 t()로 쓰세요 (docs/14-i18n-plan.md)',
        })),
      ],
    },
  },
  {
    files: ['**/*.config.{js,ts}', 'scripts/**/*.js'],
    languageOptions: { globals: globals.node },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
]);
