import customTranslationNodeCss from "@/assets/styles/custom-translation-node.css?raw"
import hostThemeCss from "@/assets/styles/host-theme.css?raw"
import translationNodePresetCss from "@/assets/styles/translation-node-preset.css?raw"
import { logger } from "@/utils/logger"

type StyleRoot = Document | ShadowRoot

// ============ Utilities ============

// Cache the probe result per root so we only touch adoptedStyleSheets once.
const constructableStyleSheetSupportMap = new WeakMap<StyleRoot, boolean>()

function supportsConstructableStyleSheets(root: StyleRoot): root is StyleRoot & { adoptedStyleSheets: CSSStyleSheet[] } {
  const cachedSupport = constructableStyleSheetSupportMap.get(root)
  if (cachedSupport !== undefined) {
    return cachedSupport
  }

  try {
    if (typeof CSSStyleSheet === "undefined") {
      constructableStyleSheetSupportMap.set(root, false)
      return false
    }

    if (!("adoptedStyleSheets" in root) || root.adoptedStyleSheets === undefined) {
      constructableStyleSheetSupportMap.set(root, false)
      return false
    }

    // Firefox content scripts can expose adoptedStyleSheets while still
    // throwing when the returned object is iterated or assigned via Xray
    // wrappers. Probe a full read -> assign -> read cycle instead of trusting
    // property existence alone.
    // Related bugs:
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1928865
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1770592
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1817675
    const probeSheet = new CSSStyleSheet()
    const previousSheets = [...root.adoptedStyleSheets]

    try {
      root.adoptedStyleSheets = [...previousSheets, probeSheet]

      const assignedSheets = [...root.adoptedStyleSheets]
      const supportsAssignment = assignedSheets.includes(probeSheet)
      constructableStyleSheetSupportMap.set(root, supportsAssignment)

      return supportsAssignment
    }
    finally {
      root.adoptedStyleSheets = previousSheets
    }
  }
  catch (error) {
    // When the browser/runtime only partially exposes constructable
    // stylesheets, fall back to injecting a normal <style> element.
    logger.warn("[style-injector] constructable stylesheet assignment failed, falling back to <style>", error)
    constructableStyleSheetSupportMap.set(root, false)
    return false
  }
}

function injectStyleElement(root: StyleRoot, id: string, cssText: string): void {
  const container = root instanceof Document ? root.head : root
  let styleElement = root.querySelector(`#${id}`) as HTMLStyleElement | null
  if (!styleElement) {
    styleElement = document.createElement("style")
    styleElement.id = id
    container.appendChild(styleElement)
  }
  if (styleElement.textContent !== cssText) {
    styleElement.textContent = cssText
  }
}

// ============ Preset Styles Injection ============

const BASE_PRESET_CSS = customTranslationNodeCss.replace(/@import[^;]+;/g, "") + translationNodePresetCss
const DOCUMENT_PRESET_CSS = hostThemeCss + BASE_PRESET_CSS
const SHADOW_PRESET_CSS = hostThemeCss.replace(/:root/g, ":host") + BASE_PRESET_CSS

const injectedPresetRoots = new WeakSet<StyleRoot>()
let documentPresetStyleSheet: CSSStyleSheet | null = null
let shadowPresetStyleSheet: CSSStyleSheet | null = null

function getPresetCSS(root: StyleRoot): string {
  return root instanceof Document ? DOCUMENT_PRESET_CSS : SHADOW_PRESET_CSS
}

function getPresetStyleSheet(root: StyleRoot): CSSStyleSheet {
  if (root instanceof Document) {
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
  if (injectedPresetRoots.has(root))
    return

  // Mark as injected first to prevent race condition with concurrent calls
  injectedPresetRoots.add(root)

  if (supportsConstructableStyleSheets(root)) {
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, getPresetStyleSheet(root)]
  }
  else {
    injectStyleElement(root, "read-frog-preset-styles", getPresetCSS(root))
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

  if (supportsConstructableStyleSheets(root)) {
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
    injectStyleElement(root, "read-frog-custom-styles", cssText)
  }

  if (root instanceof Document) {
    documentCachedCSS = cssText
  }
}
