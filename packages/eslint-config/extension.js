import pluginQuery from '@tanstack/eslint-plugin-query'
import { createTypedConfig } from './base.js'

export const config = createTypedConfig({
  react: true,
}).append({
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
    'react-hooks-extra/no-direct-set-state-in-use-effect': 'error',
    'react-hooks-extra/no-direct-set-state-in-use-layout-effect': 'error',
  },
})
