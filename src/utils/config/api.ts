import type { ProvidersConfig } from '@/types/config/provider'
import { isReadProviderConfig } from '@/types/config/provider'

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
