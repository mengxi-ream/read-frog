import type { TranslationNodeStyleConfig } from "@/types/config/translate"
import { camelCase } from "case-anything"
import { translationNodeStylePresetSchema } from "@/types/config/translate"
import { CUSTOM_TRANSLATION_NODE_ATTRIBUTE } from "@/utils/constants/translation-node-style"
import { getContainingShadowRoot, getOwnerDocument } from "../../dom/node"
import { ensureCustomCSS, ensurePresetStyles } from "./style-injector"

const customTranslationNodeAttribute = camelCase(CUSTOM_TRANSLATION_NODE_ATTRIBUTE)

export async function decorateTranslationNode(
  translatedNode: HTMLElement,
  styleConfig: TranslationNodeStyleConfig,
): Promise<void> {
  if (translationNodeStylePresetSchema.safeParse(styleConfig.preset).error) return

  // The node's own document rather than the ambient one: on a real page the two are the same, but
  // the options page previews this inside an iframe, and the styling has to land in the frame that
  // holds the node instead of on the settings page around it.
  const root = getContainingShadowRoot(translatedNode) ?? getOwnerDocument(translatedNode)

  if (styleConfig.isCustom && styleConfig.customCSS) {
    translatedNode.dataset[customTranslationNodeAttribute] = "custom"
    await ensureCustomCSS(root, styleConfig.customCSS)
    return
  }

  translatedNode.dataset[customTranslationNodeAttribute] = styleConfig.preset
  ensurePresetStyles(root)
}
