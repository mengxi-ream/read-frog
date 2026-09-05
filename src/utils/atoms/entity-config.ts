import type { APIProviderConfig } from "@/types/config/provider"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { atom } from "jotai"
import { isAPIProviderConfig } from "@/types/config/provider"
import { findSelectionToolbarAction, replaceSelectionToolbarAction } from "@/utils/custom-actions"
import { sanitizeSelectionToolbarCustomAction } from "@/utils/notebase/connection"
import { writeConfigAtom } from "./config"

export const patchProviderConfigAtom = atom(
  null,
  async (_get, set, { id, changes }: { id: string; changes: Partial<APIProviderConfig> }) => {
    await set(writeConfigAtom, (current) => {
      const provider = current.providersConfig.find((item) => item.id === id)
      if (!provider || !isAPIProviderConfig(provider)) throw new Error("Provider no longer exists")
      const next = { ...provider, ...changes, id } as APIProviderConfig
      return {
        providersConfig: current.providersConfig.map((item) => (item.id === id ? next : item)),
      }
    })
  },
)

export const patchActionConfigAtom = atom(
  null,
  async (
    _get,
    set,
    { id, changes }: { id: string; changes: Partial<SelectionToolbarCustomAction> },
  ) => {
    await set(writeConfigAtom, (current) => {
      const action = findSelectionToolbarAction(current.selectionToolbar, id)
      if (!action) throw new Error("Action no longer exists")
      const next = sanitizeSelectionToolbarCustomAction({ ...action, ...changes, id })
      return { selectionToolbar: replaceSelectionToolbarAction(current.selectionToolbar, next) }
    })
  },
)
