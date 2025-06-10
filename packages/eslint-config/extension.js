import { antfuConfig as baseAntfuConfig } from './base.js'
import antfu from '@antfu/eslint-config'
import pluginQuery from '@tanstack/eslint-plugin-query'

export const config = antfu(
  {
    ...baseAntfuConfig,
    react: true,
  },
  {
    plugins: {
      '@tanstack/query': pluginQuery,
    },
    rules: {
      'react-refresh/only-export-components': 'off',
      '@tanstack/query/exhaustive-deps': 'error',
      '@tanstack/query/no-rest-destructuring': 'warn',
      '@tanstack/query/stable-query-client': 'error',
    },
  },
)