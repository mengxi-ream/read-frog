import type { Config } from "@/types/config/config"
import type { ProviderConfig } from "@/types/config/provider"
import type { SelectionToolbarCustomFeature } from "@/types/config/selection-toolbar"
import { dequal } from "dequal"
import { atom } from "jotai"
import { atomFamily } from "jotai-family"
import { selectAtom } from "jotai/utils"
import { configAtom } from "@/utils/atoms/config"
import { getProviderConfigById } from "@/utils/config/helpers"
import { resolveProviderConfigOrNull } from "@/utils/constants/feature-providers"

export const selectionContentAtom = atom<string | null>(null)
export const selectionRangeAtom = atom<Range | null>(null)
export const isSelectionToolbarVisibleAtom = atom<boolean>(false)

function createSelectionToolbarFeatureRequestAtom<T>(
  featureKey: "selectionToolbar.translate" | "selectionToolbar.vocabularyInsight", // TODO: make these string in const map
  buildSlice: (config: Config, providerConfig: ProviderConfig | null) => T,
) {
  return selectAtom(
    configAtom,
    config => buildSlice(config, resolveProviderConfigOrNull(config, featureKey)),
    dequal,
  )
}

export interface SelectionToolbarTranslateRequestSlice {
  language: Config["language"]
  enableAIContentAware: boolean
  customPromptsConfig: Config["translate"]["customPromptsConfig"]
  providerConfig: ProviderConfig | null
}

export const selectionToolbarTranslateRequestAtom = createSelectionToolbarFeatureRequestAtom(
  "selectionToolbar.translate",
  (config, providerConfig): SelectionToolbarTranslateRequestSlice => ({
    language: config.language,
    enableAIContentAware: config.translate.enableAIContentAware,
    customPromptsConfig: config.translate.customPromptsConfig,
    providerConfig,
  }),
)

export interface SelectionToolbarVocabularyInsightRequestSlice {
  language: Config["language"]
  providerConfig: ProviderConfig | null
}

export const selectionToolbarVocabularyInsightRequestAtom = createSelectionToolbarFeatureRequestAtom(
  "selectionToolbar.vocabularyInsight",
  (config, providerConfig): SelectionToolbarVocabularyInsightRequestSlice => ({
    language: config.language,
    providerConfig,
  }),
)

export interface SelectionToolbarCustomFeatureRequestSlice {
  language: Config["language"]
  feature: SelectionToolbarCustomFeature | null
  providerConfig: ProviderConfig | null
}

export const selectionToolbarCustomFeatureRequestAtomFamily = atomFamily((featureId: string) =>
  selectAtom(
    configAtom,
    (config): SelectionToolbarCustomFeatureRequestSlice => {
      const feature = config.selectionToolbar.customFeatures
        .find(candidate => candidate.enabled !== false && candidate.id === featureId) ?? null

      return {
        language: config.language,
        feature,
        providerConfig: feature
          ? getProviderConfigById(config.providersConfig, feature.providerId) ?? null
          : null,
      }
    },
    dequal,
  ),
)
