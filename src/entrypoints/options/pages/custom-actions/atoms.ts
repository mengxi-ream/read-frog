import { atom } from "jotai"
import { requestEditorNavigationAtom } from "@/components/form/autosave-navigation"
import { BUILT_IN_DICTIONARY_ACTION_ID } from "@/utils/constants/custom-action"

const internalSelectedCustomActionIdAtom = atom<string | undefined>(undefined)

export const selectedCustomActionIdAtom = atom(
  (get) => {
    const selected = get(internalSelectedCustomActionIdAtom)

    if (selected) return selected

    return BUILT_IN_DICTIONARY_ACTION_ID
  },
  (get, set, newValue: string | undefined) => {
    if (get(internalSelectedCustomActionIdAtom) === newValue) return Promise.resolve(true)
    return set(requestEditorNavigationAtom, () => {
      set(internalSelectedCustomActionIdAtom, newValue)
    })
  },
)
