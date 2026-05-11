import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

/**
 * Flat config. Three layers:
 *
 *   1. JS recommended baseline.
 *   2. TypeScript recommended (typed rules disabled — they need a tsconfig
 *      plumbed in and the project already uses `tsc --noEmit` for that).
 *   3. React + react-hooks for JSX correctness, then prettier-recommended
 *      LAST so it turns off every formatting rule that would fight the
 *      formatter.
 *
 * We deliberately keep the rule set short — the test for "is this useful
 * to enable" is "would it catch a real bug here that types or tests
 * miss?". Stylistic preferences are Prettier's job.
 */
export default [
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'web-build/**',
      'coverage/**',
      'crave/**', // Nested repo clone the agent maintains inside the worktree.
      'lib/assistant.ts', // JSDoc-only file with a heredoc Deno snippet that confuses the parser.
      'metro.config.js', // Expo's metro shim must use CJS require.
      'babel.config.js', // Same — Expo expects CJS.
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        __DEV__: 'readonly',
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // We use `_` prefix for intentionally-unused vars.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // RN sometimes uses any{} for style passthroughs.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Empty catch bodies are legit in storage shims (see /* noop */ pattern).
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      // Tests assert against any-shaped fixtures freely.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  prettier,
];
