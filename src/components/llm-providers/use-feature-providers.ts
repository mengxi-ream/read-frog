import type { ProviderConfig } from "@/types/config/provider"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import type { FeatureKey } from "@/utils/constants/feature-providers"
import type { ProviderSelectorOption } from "@/utils/providers/provider-display"
import { useAtomValue, useSetAtom } from "jotai"
import { useCallback, useMemo } from "react"
import { configAtom, configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import { getProviderConfigById } from "@/utils/config/helpers"
import {
  buildFeatureProviderPatch,
  FEATURE_PROVIDER_DEFS,
} from "@/utils/constants/feature-providers"
import { getSelectionToolbarActions, patchSelectionToolbarAction } from "@/utils/custom-actions"
import { getSelectableProvidersForCapability } from "@/utils/providers/provider-registry"

export interface FeatureProviderBinding {
  providers: ProviderSelectorOption[]
  providerId: string
  providerConfig: ProviderConfig | null
  setProviderId: (providerId: string) => void
}

/** Reads and writes the provider a built-in feature runs on, independent of how it is laid out. */
export function useFeatureProvider(featureKey: FeatureKey): FeatureProviderBinding {
  const config = useAtomValue(configAtom)
  const setConfig = useSetAtom(writeConfigAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const providerId = FEATURE_PROVIDER_DEFS[featureKey].getProviderId(config)

  const providers = useMemo(
    () => getSelectableProvidersForCapability(featureKey, providersConfig),
    [featureKey, providersConfig],
  )

  const setProviderId = useCallback(
    (id: string) => void setConfig(buildFeatureProviderPatch({ [featureKey]: id })),
    [featureKey, setConfig],
  )

  return {
    providers,
    providerId,
    providerConfig: getProviderConfigById(providersConfig, providerId) ?? null,
    setProviderId,
  }
}

export interface CustomActionProvidersBinding {
  /** Only the actions the user can actually trigger, so disabled ones stay out of the UI. */
  actions: SelectionToolbarCustomAction[]
  providers: ProviderSelectorOption[]
  getProviderConfig: (action: SelectionToolbarCustomAction) => ProviderConfig | null
  setActionProviderId: (actionId: string, providerId: string) => void
}

/** Same as `useFeatureProvider`, for the custom AI actions in the selection toolbar. */
export function useCustomActionProviders(): CustomActionProvidersBinding {
  const config = useAtomValue(configAtom)
  const setConfig = useSetAtom(writeConfigAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

  const providers = useMemo(
    () => getSelectableProvidersForCapability("selectionToolbar.customAction", providersConfig),
    [providersConfig],
  )

  const actions = useMemo(
    () =>
      getSelectionToolbarActions(config.selectionToolbar).filter(
        (action) => action.enabled !== false,
      ),
    [config.selectionToolbar],
  )

  const setActionProviderId = useCallback(
    (actionId: string, providerId: string) =>
      void setConfig({
        selectionToolbar: patchSelectionToolbarAction(config.selectionToolbar, actionId, {
          providerId,
        }),
      }),
    [config.selectionToolbar, setConfig],
  )

  const getProviderConfig = useCallback(
    (action: SelectionToolbarCustomAction) =>
      getProviderConfigById(providersConfig, action.providerId) ?? null,
    [providersConfig],
  )

  return { actions, providers, getProviderConfig, setActionProviderId }
}
