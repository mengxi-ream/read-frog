import type { TranslationNodeStyleConfig } from '@/types/config/translate'
import { camelCase } from 'case-anything'
import { translationNodeStylePresetSchema } from '@/types/config/translate'
import { CUSTOM_TRANSLATION_NODE_ATTRIBUTE } from '@/utils/constants/translation-node-style'
import { getContainingShadowRoot } from '../../dom/node'
import { ensureCustomCSS, ensurePresetStyles } from './style-injector'

const customTranslationNodeAttribute = camelCase(CUSTOM_TRANSLATION_NODE_ATTRIBUTE)

export async function decorateTranslationNode(
  translatedNode: HTMLElement,
  styleConfig: TranslationNodeStyleConfig,
): Promise<void> {
  if (translationNodeStylePresetSchema.safeParse(styleConfig.preset).error)
    return

  const root = getContainingShadowRoot(translatedNode) ?? document

  if (styleConfig.isCustom && styleConfig.customCSS) {
    translatedNode.dataset[customTranslationNodeAttribute] = 'custom'
    await ensureCustomCSS(root, styleConfig.customCSS)
    return
  }

  translatedNode.dataset[customTranslationNodeAttribute] = styleConfig.preset
  ensurePresetStyles(root)
}
