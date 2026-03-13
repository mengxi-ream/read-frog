import { useAtomValue } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { SelectionToolbarCustomFeatureAction } from "./custom-feature-action"

export function SelectionToolbarCustomFeatureButtons() {
  const selectionToolbarConfig = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const customFeatures = selectionToolbarConfig.customFeatures?.filter(feature => feature.enabled !== false) ?? []

  return customFeatures.map(feature => (
    <SelectionToolbarCustomFeatureAction key={feature.id} feature={feature} />
  ))
}
