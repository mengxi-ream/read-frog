import deepmerge from 'deepmerge'

import { CONFIG_SCHEMA_VERSION } from '../constants/config'

export const LATEST_SCHEMA_VERSION = CONFIG_SCHEMA_VERSION

export const migrations: Record<number, (config: any) => any> = {
  2: (oldConfig) => {
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
  4: (oldConfig) => {
    const oldProvidersConfig = oldConfig.providersConfig
    const transferredProvidersConfig = Object.fromEntries(
      Object.entries(oldProvidersConfig).map(([key, value]) => {
        return [key, {
          apiKey: (value as any).apiKey,
        }]
      }),
    )

    const newProvidersConfig = {
      ...transferredProvidersConfig,
      openrouter: {
        apiKey: undefined,
      },
    }

    const transferredModelsConfig = Object.fromEntries(
      Object.entries(oldProvidersConfig).map(([key, value]) => {
        return [key, {
          model: (value as any).model,
          isCustomModel: (value as any).isCustomModel,
          customModel: (value as any).customModel,
        }]
      }),
    )
    const newReadConfig = {
      provider: oldConfig.provider,
      models: transferredModelsConfig,
    }
    const newTranslateModelsConfig = {
      ...transferredModelsConfig,
      openrouter: {
        model: 'meta-llama/llama-4-maverick:free',
        isCustomModel: false,
        customModel: '',
      },
    }

    const newTranslateConfig = {
      provider: oldConfig.translate.provider,
      models: {
        google: null,
        microsoft: null,
        ...newTranslateModelsConfig,
      },
      node: oldConfig.translate.node,
      page: oldConfig.translate.page,
    }

    const { language, floatingButton, sideContent, ..._restConfig } = oldConfig
    return {
      language,
      floatingButton,
      sideContent,
      providersConfig: newProvidersConfig,
      read: newReadConfig,
      translate: newTranslateConfig,
    }
  },
}
