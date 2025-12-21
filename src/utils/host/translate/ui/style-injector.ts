import customTranslationNodeCss from '@/assets/styles/custom-translation-node.css?raw'
import hostThemeCss from '@/assets/styles/host-theme.css?raw'

type StyleRoot = Document | ShadowRoot

// ============ Utilities ============

function supportsAdoptedStyleSheets(root: StyleRoot): boolean {
  try {
    return 'adoptedStyleSheets' in root
      && root.adoptedStyleSheets !== undefined
      && Array.isArray(root.adoptedStyleSheets)
  }
  catch {
    return false
  }
}

function injectStyleElement(root: StyleRoot, id: string, cssText: string): void {
  const container = root instanceof Document ? root.head : root
  let styleElement = root.querySelector(`#${id}`) as HTMLStyleElement | null
  if (!styleElement) {
    styleElement = document.createElement('style')
    styleElement.id = id
    container.appendChild(styleElement)
  }
  if (styleElement.textContent !== cssText) {
    styleElement.textContent = cssText
  }
}

// ============ Preset Styles Injection ============

// Process CSS for shadow root context:
// 1. host-theme.css: Replace :root with :host (shadow roots don't inherit :root variables)
// 2. custom-translation-node.css: Remove @import line (already imported separately)
const HOST_THEME_CSS = hostThemeCss.replace(/:root/g, ':host')
const PRESET_STYLES_CSS = customTranslationNodeCss.replace(/@import[^;]+;/g, '')
const FULL_PRESET_CSS = HOST_THEME_CSS + PRESET_STYLES_CSS

const injectedPresetRoots = new WeakSet<StyleRoot>()
let presetStyleSheet: CSSStyleSheet | null = null

function getPresetStyleSheet(): CSSStyleSheet {
  if (!presetStyleSheet) {
    presetStyleSheet = new CSSStyleSheet()
    presetStyleSheet.replaceSync(FULL_PRESET_CSS)
  }
  return presetStyleSheet
}

/** Ensure preset styles are injected into the given root (skip Document, injected via manifest) */
export function ensurePresetStyles(root: StyleRoot): void {
  // Document preset styles are injected via manifest cssInjectionMode, skip
  if (root instanceof Document)
    return

  if (injectedPresetRoots.has(root))
    return

  // Mark as injected first to prevent race condition with concurrent calls
  injectedPresetRoots.add(root)

  if (supportsAdoptedStyleSheets(root)) {
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, getPresetStyleSheet()]
  }
  else {
    injectStyleElement(root, 'read-frog-preset-styles', FULL_PRESET_CSS)
  }
}

// ============ Custom CSS Injection ============

const customCSSMap = new WeakMap<StyleRoot, CSSStyleSheet>()
let documentCachedCSS: string | null = null

/** Inject custom CSS into the given root */
export async function ensureCustomCSS(root: StyleRoot, cssText: string): Promise<void> {
  // Ensure preset styles are injected first (provides CSS variables)
  ensurePresetStyles(root)

  // Document-level cache optimization
  if (root instanceof Document && documentCachedCSS === cssText) {
    return
  }

  if (supportsAdoptedStyleSheets(root)) {
    let sheet = customCSSMap.get(root)
    if (!sheet) {
      sheet = new CSSStyleSheet()
      // Set in map first to prevent race condition with concurrent calls
      customCSSMap.set(root, sheet)
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]
    }
    await sheet.replace(cssText)
  }
  else {
    injectStyleElement(root, 'read-frog-custom-styles', cssText)
  }

  if (root instanceof Document) {
    documentCachedCSS = cssText
  }
}
