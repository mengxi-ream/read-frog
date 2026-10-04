import type { CustomActionResultStorageProvider } from "./types"
import { useEffect, useState } from "react"
import {
  getCustomActionResultStorageSettings,
  watchCustomActionResultStorageSettings,
} from "./settings"

/**
 * Resolves the provider from extension-local settings before mounting any
 * Notebase/auth hooks. `null` means settings are still loading.
 */
export function useCustomActionResultStorageProvider(): CustomActionResultStorageProvider | null {
  const [provider, setProvider] = useState<CustomActionResultStorageProvider | null>(null)

  useEffect(() => {
    let active = true
    void getCustomActionResultStorageSettings()
      .then((settings) => {
        if (active) setProvider(settings.provider)
      })
      .catch(() => {
        // Keep the save control inert if extension storage cannot be read;
        // guessing the provider could trigger an unintended cloud request.
      })

    const unwatch = watchCustomActionResultStorageSettings((settings) => {
      if (active) setProvider(settings.provider)
    })

    return () => {
      active = false
      unwatch()
    }
  }, [])

  return provider
}
