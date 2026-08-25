import type { TranslationNodeStyleConfig } from "@/types/config/translate"
import { camelCase } from "case-anything"
import { translationNodeStylePresetSchema } from "@/types/config/translate"
import { CUSTOM_TRANSLATION_NODE_ATTRIBUTE } from "@/utils/constants/translation-node-style"
import { getContainingShadowRoot, getOwnerDocument } from "../../dom/node"
import { clearCustomCSS, ensureCustomCSS, ensurePresetStyles } from "./style-injector"

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
  // The attribute alone is not enough to go back to a preset: custom CSS from an earlier call is
  // still adopted on this root, and anything the preset does not set — `border` sets no colour, for
  // one — is still wearing it.
  await clearCustomCSS(root)
}
