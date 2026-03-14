import { atom } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"

const internalSelectedCustomActionIdAtom = atom<string | undefined>(undefined)

export const selectedCustomActionIdAtom = atom(
  (get) => {
    const customActions = get(configFieldsAtomMap.selectionToolbar).customActions
    const selected = get(internalSelectedCustomActionIdAtom)

    if (selected && customActions.some(action => action.id === selected)) {
      return selected
    }

    return customActions[0]?.id
  },
  (_get, set, newValue: string | undefined) => {
    set(internalSelectedCustomActionIdAtom, newValue)
  },
)
