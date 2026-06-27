import { atom } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getAPIProvidersConfig } from "@/utils/config/helpers"
import { FREE_AI_PROVIDER_ID } from "@/utils/providers/provider-registry"

const internalSelectedProviderIdAtom = atom<string | undefined>(undefined)

export const selectedProviderIdAtom = atom(
  (get) => {
    const selected = get(internalSelectedProviderIdAtom)
    if (selected !== undefined) {
      return selected
    }

    const providersConfig = get(configFieldsAtomMap.providersConfig)
    const apiProvidersConfig = getAPIProvidersConfig(providersConfig)
    const firstProviderId = apiProvidersConfig.length > 0
      ? apiProvidersConfig[0].id
      : FREE_AI_PROVIDER_ID
    return firstProviderId
  },
  (_get, set, newValue: string | undefined) => {
    set(internalSelectedProviderIdAtom, newValue)
  },
)
