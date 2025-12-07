import type { LangCodeISO6393 } from '@read-frog/definitions'
import type { Config } from '@/types/config/config'
import type { ProvidersConfig } from '@/types/config/provider'
import { storage } from '#imports'
import { configSchema } from '@/types/config/config'
import { isReadProviderConfig } from '@/types/config/provider'
import {
  CONFIG_STORAGE_KEY,
  DEFAULT_CONFIG,
  DEFAULT_DETECTED_CODE,
  DETECTED_CODE_STORAGE_KEY,
} from '../constants/config'
import { logger } from '../logger'

export async function getDetectedCodeFromStorage(): Promise<LangCodeISO6393> {
  return await storage.getItem<LangCodeISO6393>(`local:${DETECTED_CODE_STORAGE_KEY}`) ?? DEFAULT_DETECTED_CODE
}

export async function getConfigFromStorage() {
  const config = await storage.getItem<Config>(`local:${CONFIG_STORAGE_KEY}`)
  if (!config) {
    logger.warn('No config found in storage')
    return null
  }
  const parsedConfig = configSchema.safeParse(config)
  if (!parsedConfig.success) {
    logger.error('Config is invalid, using default config')
    return DEFAULT_CONFIG
  }
  return parsedConfig.data
}

export function isAnyAPIKeyForReadProviders(providersConfig: ProvidersConfig) {
  const readProvidersConfig = providersConfig.filter(isReadProviderConfig)
  return readProvidersConfig.some((providerConfig) => {
    return providerConfig.apiKey
  }) || readProvidersConfig.some((providerConfig) => {
    return providerConfig.provider === 'ollama'
  })
}

// Dynamically adapt to all API key situations, theoretically should not fail
export function getObjectWithoutAPIKeys<T extends Record<string, any>>(originalObject: T): T {
  function deepClean(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(deepClean)
    }
    if (obj && typeof obj === 'object') {
      const newObj: Record<string, any> = {}
      for (const key in obj) {
        if (key === 'apiKey') {
          continue
        }
        newObj[key] = deepClean(obj[key])
      }
      return newObj
    }
    return obj
  }

  try {
    return deepClean(originalObject)
  }
  catch {
    return originalObject
  }
}

export function hasAPIKey(obj: any): boolean {
  function deepCheck(obj: any): boolean {
    if (Array.isArray(obj)) {
      return obj.some(deepCheck)
    }
    if (obj && typeof obj === 'object') {
      for (const key in obj) {
        if (key === 'apiKey' && obj[key]) {
          return true
        }
        if (deepCheck(obj[key])) {
          return true
        }
      }
    }
    return false
  }

  try {
    return deepCheck(obj)
  }
  catch {
    return false
  }
}
