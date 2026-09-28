import type { StyleRoot } from "@/utils/dom/constructable-stylesheets"
import customTranslationNodeCss from "@/assets/styles/custom-translation-node.css?raw"
import hostThemeCss from "@/assets/styles/host-theme.css?raw"
import translationNodePresetCss from "@/assets/styles/translation-node-preset.css?raw"
import {
  getRootDocument,
  isDocumentRoot,
  supportsConstructableStyleSheets,
} from "@/utils/dom/constructable-stylesheets"

// ============ Utilities ============

function injectStyleElement(root: StyleRoot, id: string, cssText: string): void {
  const container = isDocumentRoot(root) ? root.head : root
  let styleElement = root.querySelector<HTMLStyleElement>(`#${id}`)
  if (!styleElement) {
    styleElement = getRootDocument(root).createElement("style")
    styleElement.id = id
    container.appendChild(styleElement)
  }
  if (styleElement.textContent !== cssText) {
    styleElement.textContent = cssText
  }
}

// ============ Preset Styles Injection ============

const BASE_PRESET_CSS =
  customTranslationNodeCss.replace(/@import[^;]+;/g, "") + translationNodePresetCss
const DOCUMENT_PRESET_CSS = hostThemeCss + BASE_PRESET_CSS
const SHADOW_PRESET_CSS = hostThemeCss.replace(/:root/g, ":host") + BASE_PRESET_CSS

const injectedPresetRoots = new WeakSet<StyleRoot>()
let documentPresetStyleSheet: CSSStyleSheet | null = null
let shadowPresetStyleSheet: CSSStyleSheet | null = null

function getPresetCSS(root: StyleRoot): string {
  return isDocumentRoot(root) ? DOCUMENT_PRESET_CSS : SHADOW_PRESET_CSS
}

function getPresetStyleSheet(root: StyleRoot): CSSStyleSheet {
  if (isDocumentRoot(root)) {
    if (!documentPresetStyleSheet) {
      documentPresetStyleSheet = new CSSStyleSheet()
      documentPresetStyleSheet.replaceSync(DOCUMENT_PRESET_CSS)
    }

    return documentPresetStyleSheet
  }

  if (!shadowPresetStyleSheet) {
    shadowPresetStyleSheet = new CSSStyleSheet()
    shadowPresetStyleSheet.replaceSync(SHADOW_PRESET_CSS)
  }

  return shadowPresetStyleSheet
}

/** Ensure preset styles are injected into the given root */
export function ensurePresetStyles(root: StyleRoot): void {
  if (injectedPresetRoots.has(root)) return

  // Mark as injected first to prevent race condition with concurrent calls
  injectedPresetRoots.add(root)

  if (supportsConstructableStyleSheets(root)) {
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, getPresetStyleSheet(root)]
  } else {
    injectStyleElement(root, "read-frog-preset-styles", getPresetCSS(root))
  }
}

// ============ Site Rule CSS Injection ============

const SITE_RULE_STYLE_ID = "read-frog-site-rule-styles"
const siteRuleCSSMap = new WeakMap<StyleRoot, CSSStyleSheet>()

/**
 * Inject per-site rule CSS into the given root. Unlike the custom-style slot
 * below, this one is removable: it only applies while a page or node
 * translation is visible on a matched site (see PageTranslationManager and
 * removeOrShowNodeTranslation).
 */
export async function ensureSiteRuleCSS(root: StyleRoot, cssText: string): Promise<void> {
  if (supportsConstructableStyleSheets(root)) {
    let sheet = siteRuleCSSMap.get(root)
    if (!sheet) {
      sheet = new CSSStyleSheet()
      // Set in map first to prevent race condition with concurrent calls
      siteRuleCSSMap.set(root, sheet)
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]
    }
    await sheet.replace(cssText)
  } else {
    injectStyleElement(root, SITE_RULE_STYLE_ID, cssText)
  }
}

/** Remove per-site rule CSS previously injected by ensureSiteRuleCSS */
export function removeSiteRuleCSS(root: StyleRoot): void {
  const sheet = siteRuleCSSMap.get(root)
  if (sheet && supportsConstructableStyleSheets(root)) {
    root.adoptedStyleSheets = root.adoptedStyleSheets.filter((adopted) => adopted !== sheet)
    siteRuleCSSMap.delete(root)
  }
  root.querySelector(`#${SITE_RULE_STYLE_ID}`)?.remove()
}

// ============ Subtitles Custom CSS Injection ============

const SUBTITLES_CUSTOM_STYLE_ID = "read-frog-subtitles-custom-styles"
const subtitlesCustomCSSMap = new WeakMap<StyleRoot, CSSStyleSheet>()

/**
 * Inject the user's subtitle CSS into the subtitles shadow root.
 *
 * Deliberately not `ensureCustomCSS` below: that one pulls in the translation preset styles first,
 * which redefine the `--rf-*` theme tokens the subtitles root already gets from `theme.css` — the
 * subtitle settings panel lives in that same root and would be recoloured by the side effect.
 *
 * Appending the sheet last is what lets custom CSS win over `subtitle-lines.css`, which is why the
 * picked font and colour reach the line as custom properties rather than as inline styles.
 */
export async function ensureSubtitlesCustomCSS(root: StyleRoot, cssText: string): Promise<void> {
  if (supportsConstructableStyleSheets(root)) {
    let sheet = subtitlesCustomCSSMap.get(root)
    if (!sheet) {
      sheet = new CSSStyleSheet()
      // Set in map first to prevent race condition with concurrent calls
      subtitlesCustomCSSMap.set(root, sheet)
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]
    }
    await sheet.replace(cssText)
  } else {
    injectStyleElement(root, SUBTITLES_CUSTOM_STYLE_ID, cssText)
  }
}

// ============ Custom CSS Injection ============

const CUSTOM_STYLE_ID = "read-frog-custom-styles"
const customCSSMap = new WeakMap<StyleRoot, CSSStyleSheet>()
let documentCachedCSS: string | null = null

/**
 * Withdraw custom CSS a previous `ensureCustomCSS` put on this root.
 *
 * Switching back to a preset, or emptying the editor, leaves the old sheet adopted otherwise — the
 * rules go on applying until the page is reloaded, and the options preview never reloads, so there
 * it reads as deleting the CSS having done nothing at all.
 *
 * Guarded so a root that never had custom CSS does not acquire an empty sheet just for being
 * styled by a preset.
 */
export async function clearCustomCSS(root: StyleRoot): Promise<void> {
  if (!customCSSMap.has(root) && !root.querySelector(`#${CUSTOM_STYLE_ID}`)) return
  await ensureCustomCSS(root, "")
}

/** Inject custom CSS into the given root */
export async function ensureCustomCSS(root: StyleRoot, cssText: string): Promise<void> {
  // Ensure preset styles are injected first (provides CSS variables)
  ensurePresetStyles(root)

  // Document-level cache optimization
  if (root === document && documentCachedCSS === cssText) {
    return
  }

  if (supportsConstructableStyleSheets(root)) {
    let sheet = customCSSMap.get(root)
    if (!sheet) {
      sheet = new CSSStyleSheet()
      // Set in map first to prevent race condition with concurrent calls
      customCSSMap.set(root, sheet)
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]
    }
    await sheet.replace(cssText)
  } else {
    injectStyleElement(root, CUSTOM_STYLE_ID, cssText)
  }

  if (root === document) {
    documentCachedCSS = cssText
  }
}
