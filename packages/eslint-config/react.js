import { createTypedConfig } from './base.js'

export const config = createTypedConfig({
  react: true,
}).append({
  rules: {
    'react-refresh/only-export-components': 'off',
    'react-hooks-extra/no-direct-set-state-in-use-effect': 'error',
    'react-hooks-extra/no-direct-set-state-in-use-layout-effect': 'error',
  },
})
