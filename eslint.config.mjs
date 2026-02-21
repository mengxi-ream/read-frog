import antfu from '@antfu/eslint-config'
import pluginQuery from '@tanstack/eslint-plugin-query'

export default antfu({
  formatters: {
    /**
     * Format CSS, LESS, SCSS files, also the `<style>` blocks
     * By default uses Prettier
     */
    css: true,
    /**
     * Format HTML files
     * By default uses Prettier
     */
    html: true,
    /**
     * Format Markdown files
     * Supports Prettier and dprint
     * By default uses Prettier
     */
    markdown: 'prettier',
  },
  ignores: [
    '**/skills/**',
  ],
  rules: {
    'unused-imports/no-unused-imports': 'error',
    'no-inner-declarations': 'error',
    'antfu/consistent-list-newline': 'off',
  },
  react: {
    overrides: {
      // Not useful in React 19 — key is no longer part of props
      'react/no-implicit-key': 'off',
    },
  },
}, [
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['.claude/**/*'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
], [
  {
    ignores: ['**/*.md/**', '.agents/**/*', '.claude/**/*', '.codex/**/*', '.cursor/**/*'],
  },
]).append({
  plugins: {
    '@tanstack/query': pluginQuery,
  },
  rules: {
    'react-refresh/only-export-components': 'off',
    '@tanstack/query/exhaustive-deps': 'error',
    '@tanstack/query/no-rest-destructuring': 'warn',
    '@tanstack/query/stable-query-client': 'error',
    'test/consistent-test-it': 'error',
    'test/no-identical-title': 'error',
    'test/prefer-hooks-on-top': 'error',
  },
})
