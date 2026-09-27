import { logger } from "@/utils/logger"

// Leaf module on purpose: the selection popup's layout styles need this probe,
// and importing it from style-injector.ts would drag the page-translation CSS
// (inlined via `?raw`) into selection.js.

export type StyleRoot = Document | ShadowRoot

/**
 * Whether the root is a Document, tested in a way that survives crossing realms.
 *
 * An iframe's Document fails an `instanceof` check run from the parent realm, and the options page
 * previews translation styling inside a same-origin frame — the only container that is also a
 * Document, which is what production injects into. `nodeType` is stable across realms and agrees
 * with `instanceof` for both production roots: Document is 9, ShadowRoot is 11.
 */
export function isDocumentRoot(root: StyleRoot): root is Document {
  return root.nodeType === Node.DOCUMENT_NODE
}

export function getRootDocument(root: StyleRoot): Document {
  return isDocumentRoot(root) ? root : (root.ownerDocument ?? document)
}

// Cache the probe result per root so we only touch adoptedStyleSheets once.
const constructableStyleSheetSupportMap = new WeakMap<StyleRoot, boolean>()

export function supportsConstructableStyleSheets(
  root: StyleRoot,
): root is StyleRoot & { adoptedStyleSheets: CSSStyleSheet[] } {
  const cachedSupport = constructableStyleSheetSupportMap.get(root)
  if (cachedSupport !== undefined) {
    return cachedSupport
  }

  try {
    if (typeof CSSStyleSheet === "undefined") {
      constructableStyleSheetSupportMap.set(root, false)
      return false
    }

    // A constructed stylesheet belongs to the realm that built it, and assigning one to another
    // document throws NotAllowedError. Nothing here can build a sheet in a foreign realm, so a root
    // from one takes the <style> path instead — the same path Firefox already falls back to. Checked
    // ahead of the probe below so the expected case does not surface as a warning.
    if (getRootDocument(root) !== document) {
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
    } finally {
      root.adoptedStyleSheets = previousSheets
    }
  } catch (error) {
    // When the browser/runtime only partially exposes constructable
    // stylesheets, fall back to injecting a normal <style> element.
    logger.warn(
      "[style-injector] constructable stylesheet assignment failed, falling back to <style>",
      error,
    )
    constructableStyleSheetSupportMap.set(root, false)
    return false
  }
}
