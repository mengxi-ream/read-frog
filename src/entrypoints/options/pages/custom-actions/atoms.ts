import { atom } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { BUILT_IN_DICTIONARY_ACTION_ID } from "@/utils/constants/custom-action"

const internalSelectedCustomActionIdAtom = atom<string | undefined>(undefined)

export const selectedCustomActionIdAtom = atom(
  (get) => {
    const customActions = get(configFieldsAtomMap.selectionToolbar).customActions
    const selected = get(internalSelectedCustomActionIdAtom)

    if (
      selected === BUILT_IN_DICTIONARY_ACTION_ID ||
      (selected && customActions.some((action) => action.id === selected))
    ) {
      return selected
    }

    return BUILT_IN_DICTIONARY_ACTION_ID
  },
  (_get, set, newValue: string | undefined) => {
    set(internalSelectedCustomActionIdAtom, newValue)
  },
)
