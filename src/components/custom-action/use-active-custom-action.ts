import type { CustomActionRequest } from "./atoms"
import { useAtomValue, useSetAtom } from "jotai"
import { useCallback, useMemo } from "react"
import { configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import { findSelectionToolbarAction, patchSelectionToolbarAction } from "@/utils/custom-actions"
import {
  getSelectableProvidersForCapability,
  resolveProviderRefForCapability,
} from "@/utils/providers/provider-registry"

export function useActiveCustomAction(request: CustomActionRequest | null) {
  const selectionToolbarConfig = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const setConfig = useSetAtom(writeConfigAtom)
  const actionId = request?.actionId ?? null

  const action = useMemo(() => {
    if (!actionId) {
      return null
    }
    const found = findSelectionToolbarAction(selectionToolbarConfig, actionId)
    return found && found.enabled !== false ? found : null
  }, [actionId, selectionToolbarConfig])
  const provider = useMemo(
    () =>
      action
        ? resolveProviderRefForCapability("customAction", providersConfig, action.providerId)
        : null,
    [action, providersConfig],
  )
  const providers = useMemo(
    () => getSelectableProvidersForCapability("customAction", providersConfig),
    [providersConfig],
  )

  const changeProvider = useCallback(
    (providerId: string) => {
      if (!actionId) {
        return
      }
      void setConfig({
        selectionToolbar: patchSelectionToolbarAction(selectionToolbarConfig, actionId, {
          providerId,
        }),
      })
    },
    [actionId, selectionToolbarConfig, setConfig],
  )

  return { action, provider, providers, changeProvider }
}
