import { getSelectionToolbarCustomFeatureTokenCellText } from "@/utils/constants/selection-toolbar-custom-feature"

export interface SelectionToolbarCustomFeaturePromptTokens {
  selection: string
  context: string
  targetLang: string
  title: string
}

export function replaceSelectionToolbarCustomFeaturePromptTokens(
  prompt: string,
  tokens: SelectionToolbarCustomFeaturePromptTokens,
) {
  return prompt
    .replaceAll(getSelectionToolbarCustomFeatureTokenCellText("selection"), tokens.selection)
    .replaceAll(getSelectionToolbarCustomFeatureTokenCellText("context"), tokens.context)
    .replaceAll(getSelectionToolbarCustomFeatureTokenCellText("targetLang"), tokens.targetLang)
    .replaceAll(getSelectionToolbarCustomFeatureTokenCellText("title"), tokens.title)
}
