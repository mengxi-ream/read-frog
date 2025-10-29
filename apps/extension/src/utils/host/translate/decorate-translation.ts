import type { TranslationNodeStyleConfig } from '@/types/config/translate'
import { camelCase } from 'case-anything'
import { translationNodeStylePresetSchema } from '@/types/config/translate'
import { CUSTOM_TRANSLATION_NODE_ATTRIBUTE } from '@/utils/constants/translation-node-style'

const customTranslationNodeAttribute = camelCase(CUSTOM_TRANSLATION_NODE_ATTRIBUTE)
const CUSTOM_CSS_SHEET_MARKER = 'read-frog-custom-css-marker'

// Cache for the custom stylesheet and its content
let customStyleSheet: CSSStyleSheet | null = null
let cachedCSSText: string | null = null

export async function decorateTranslationNode(translatedNode: HTMLElement, styleConfig: TranslationNodeStyleConfig) {
  // Validate preset style
  if (translationNodeStylePresetSchema.safeParse(styleConfig.preset).error)
    return

  // Handle custom CSS style
  if (styleConfig.isCustom && styleConfig.customCSS) {
    // Set dataset attribute to 'custom'
    translatedNode.dataset[customTranslationNodeAttribute] = 'custom'

    // Inject custom CSS using Constructable Stylesheets API (modern approach)
    // This is more performant and doesn't pollute the DOM
    const cssText = styleConfig.customCSS

    // Skip injection if CSS hasn't changed
    if (cachedCSSText === cssText) {
      return
    }

    // Check if browser supports Constructable Stylesheets
    if ('adoptedStyleSheets' in document) {
      try {
        // Reuse existing stylesheet or create new one
        if (!customStyleSheet) {
          customStyleSheet = new CSSStyleSheet()
          document.adoptedStyleSheets = [...document.adoptedStyleSheets, customStyleSheet]
        }

        // Update stylesheet content only if changed
        await customStyleSheet.replace(cssText)
        cachedCSSText = cssText
      }
      catch (error) {
        // Fallback to traditional <style> tag if CSSStyleSheet fails
        console.warn('Failed to use Constructable Stylesheets, falling back to <style> tag:', error)
        injectStyleElement(cssText)
        cachedCSSText = cssText
      }
    }
    else {
      // Fallback for older browsers
      injectStyleElement(cssText)
      cachedCSSText = cssText
    }

    return
  }

  // Handle predefined styles
  translatedNode.dataset[customTranslationNodeAttribute] = styleConfig.preset
}

// Fallback method: inject <style> tag into DOM
function injectStyleElement(cssText: string): void {
  let styleElement = document.getElementById(CUSTOM_CSS_SHEET_MARKER) as HTMLStyleElement

  if (!styleElement) {
    styleElement = document.createElement('style')
    styleElement.id = CUSTOM_CSS_SHEET_MARKER
    document.head.appendChild(styleElement)
  }

  if (styleElement.textContent !== cssText) {
    styleElement.textContent = cssText
  }
}
