import deepmerge from 'deepmerge'

import { CONFIG_SCHEMA_VERSION } from '../constants/config'

export const LATEST_SCHEMA_VERSION = CONFIG_SCHEMA_VERSION

export const migrations: Record<number, (config: any) => any> = {
  2: (oldConfig) => {
    // add pageTranslate config
    return deepmerge(oldConfig, {
      pageTranslate: {
        range: 'mainContent',
      },
    })
  },
  3: (oldConfig) => {
    const {
      manualTranslate,
      pageTranslate,
      ...restConfig
    } = oldConfig

    if (pageTranslate.range === 'mainContent') {
      pageTranslate.range = 'main'
    }

    return deepmerge(restConfig, {
      translate: {
        provider: 'microsoft',
        node: manualTranslate,
        page: pageTranslate,
      },
    })
  },
}
