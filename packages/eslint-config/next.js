import { antfuConfig as baseAntfuConfig } from './base.js'
import antfu from '@antfu/eslint-config'
import pluginNext from '@next/eslint-plugin-next'


export const config = antfu(
  {
    ...baseAntfuConfig,
    react: true,
  },
  {
    plugins: {
      "@next/next": pluginNext,
    },
    rules: {
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs["core-web-vitals"].rules,
      'react-refresh/only-export-components': 'off',
    },
  },
)