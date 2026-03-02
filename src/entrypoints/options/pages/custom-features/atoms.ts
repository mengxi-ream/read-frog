import { atom } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"

const internalSelectedCustomFeatureIdAtom = atom<string | undefined>(undefined)

export const selectedCustomFeatureIdAtom = atom(
  (get) => {
    const customFeatures = get(configFieldsAtomMap.selectionToolbar).customFeatures
    const selected = get(internalSelectedCustomFeatureIdAtom)

    if (selected && customFeatures.some(feature => feature.id === selected)) {
      return selected
    }

    return customFeatures[0]?.id
  },
  (_get, set, newValue: string | undefined) => {
    set(internalSelectedCustomFeatureIdAtom, newValue)
  },
)
