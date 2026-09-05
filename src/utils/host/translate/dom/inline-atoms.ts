import type { Config } from "@/types/config/config"
import type { TransNode } from "@/types/dom"
import {
  CONTENT_WRAPPER_CLASS,
  INLINE_ATOM_CLASS,
  MARK_ATTRIBUTES,
} from "@/utils/constants/dom-labels"
import { logger } from "@/utils/logger"
import { getEffectiveSiteRule } from "@/utils/site-rules/effective"
import { isDontWalkIntoAndDontTranslateAsChildElement, isInlineAtomElement } from "../../dom/filter"
import { extractTextContent } from "../../dom/traversal"
import {
  decodeInlineAtomTokens,
  encodeInlineAtomToken,
  nextFreeInlineAtomIndex,
} from "../inline-atom-tokens"

/**
 * Inline atoms for bilingual page translation.
 *
 * A rendered formula (native MathML, KaTeX, MathJax, Wikipedia math) carries
 * no translatable text, yet its subtree is exactly what the plain-text
 * extractor cannot represent: dont-walk tags collapse to "" and KaTeX's glyph
 * spans leak as soup. Instead of teaching the provider markup, the paragraph
 * is extracted ONCE with every atom replaced by a `{{n}}` placeholder
 * (`requestText`) while the prose-only string every existing filter already
 * sees is kept alongside (`filterText`). After translation the placeholders
 * are located again and sanitized clones of the original elements are put in
 * their place. Paragraphs without atoms are byte-identical to the legacy path.
 */
export interface InlineAtomExtraction {
  /** Legacy extraction: atoms contribute "". Feeds the numeric/small-paragraph/language filters. */
  filterText: string
  /** Prose with one `{{n}}` per renderable atom. Sent to the provider. */
  requestText: string
  /** Source elements in document order; never clones. */
  atoms: readonly HTMLElement[]
  /** Token numbering starts here so token-shaped literals in the prose never collide. */
  baseIndex: number
  /** Whether `filterText` contains any letter — token-only runs must not be sent. */
  hasProse: boolean
}

// OBJECT REPLACEMENT CHARACTER: an in-band marker for the single extraction
// pass, swapped for real tokens once the collision offset is known.
const ATOM_SENTINEL = "￼"
const ATOM_SENTINEL_RE = /￼/g
const PROSE_RE = /\p{L}/u

/**
 * An atom worth a placeholder must render something. MathJax v2 leaves an
 * empty `span.MathJax_Preview` beside every typeset formula; cloning it would
 * only add a token the provider can drop.
 */
export function isRenderableInlineAtom(element: HTMLElement): boolean {
  return element.firstElementChild !== null || (element.textContent ?? "").trim() !== ""
}

export function extractInlineAtomText(
  nodes: readonly TransNode[],
  config: Config,
): InlineAtomExtraction {
  const atoms: HTMLElement[] = []

  const replaceElement = (element: HTMLElement): string | undefined => {
    if (!isInlineAtomElement(element, config)) return undefined
    if (element.localName === "math") {
      // A <math> nested inside a renderer wrapper the walk already treats as
      // one unit (KaTeX's .katex-mathml, MathJax's assistive MathML) is the
      // hidden accessible copy of a formula that wrapper renders. Cloning it
      // next to the wrapper's own text would show the formula twice, so it
      // stays dropped exactly as before; the wrapper is the atom when a rule
      // says so. Native <math> also never reaches getComputedStyle, which
      // some environments refuse for MathML.
      const { preserveTextSelector } = getEffectiveSiteRule(config, window.location.href)
      if (preserveTextSelector !== null && element.parentElement?.closest(preserveTextSelector)) {
        return ""
      }
    } else if (isDontWalkIntoAndDontTranslateAsChildElement(element, config)) {
      // Hidden or site-excluded atoms keep today's behavior (dropped).
      return ""
    }
    if (!isRenderableInlineAtom(element)) return ""
    atoms.push(element)
    return ATOM_SENTINEL
  }

  const raw = nodes.map((node) => extractTextContent(node, config, { replaceElement })).join("")
  if (atoms.length === 0) {
    return { filterText: raw, requestText: raw, atoms, baseIndex: 0, hasProse: PROSE_RE.test(raw) }
  }

  const sentinelCount = raw.split(ATOM_SENTINEL).length - 1
  if (sentinelCount !== atoms.length) {
    // The page text itself contains U+FFFC, so atoms cannot be told apart from
    // it. Fall back to the legacy string rather than guess.
    const legacy = nodes.map((node) => extractTextContent(node, config)).join("")
    return {
      filterText: legacy,
      requestText: legacy,
      atoms: [],
      baseIndex: 0,
      hasProse: PROSE_RE.test(legacy),
    }
  }

  const filterText = raw.replace(ATOM_SENTINEL_RE, "")
  const baseIndex = nextFreeInlineAtomIndex(filterText)
  let nextIndex = baseIndex
  const requestText = raw.replace(ATOM_SENTINEL_RE, () => encodeInlineAtomToken(nextIndex++))

  return { filterText, requestText, atoms, baseIndex, hasProse: PROSE_RE.test(filterText) }
}

// Subtrees a clone must not carry: executable or resource-loading elements,
// and the hidden accessible copies every renderer ships next to its visible
// output (they would double the clone's text and, for MathJax, invite a
// second typeset). `<semantics>` renders its first child, so dropping the
// annotations keeps native MathML intact.
const REMOVED_DESCENDANT_SELECTOR = [
  "script",
  "noscript",
  "template",
  "style",
  "link",
  "meta",
  "iframe",
  "object",
  "embed",
  "mjx-assistive-mml",
  ".MJX_Assistive_MathML",
  ".katex-mathml",
  "annotation",
  "annotation-xml",
].join(",")

const REMOVED_ATTRIBUTE_NAMES = new Set([
  "id",
  "tabindex",
  "contenteditable",
  "draggable",
  "srcdoc",
  "aria-labelledby",
  "aria-describedby",
  ...MARK_ATTRIBUTES,
])

const URL_ATTRIBUTE_NAMES = new Set(["href", "xlink:href", "src", "action", "formaction", "data"])
const UNSAFE_URL_RE = /^\s*(?:javascript:|data:text\/html)/i

// Classes every MathJax generation and its preprocessors honor as "leave this
// subtree alone", so a page-side typesetter never re-renders our clone.
const TYPESET_IGNORE_CLASSES = [
  "mathjax_ignore",
  "tex2jax_ignore",
  "mml2jax_ignore",
  "asciimath2jax_ignore",
]

let cloneSequence = 0

/**
 * Deep-clone an atom for insertion into a translated span. Keeps everything
 * the renderer's CSS depends on (classes, inline styles, `<img src>`, SVG
 * `<use xlink:href>`), drops ids and anything executable, and marks the root
 * so the preset stylesheet, MathJax and assistive technology all leave it
 * alone. The source element is never touched.
 */
export function sanitizeInlineAtomClone(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement

  for (const removed of [...clone.querySelectorAll(REMOVED_DESCENDANT_SELECTOR)]) {
    removed.remove()
  }

  const elements: Element[] = [clone, ...clone.querySelectorAll("*")]

  // MathJax SVG output with a local font cache references `<defs>` inside the
  // same formula by id. Those references must keep resolving inside the clone,
  // so referenced ids are renamed (unique per clone) instead of stripped.
  const idOwners = new Map<string, Element>()
  for (const element of elements) {
    const id = element.getAttribute("id")
    if (id && !idOwners.has(id)) idOwners.set(id, element)
  }
  const renamedIds = new Map<string, string>()
  for (const element of elements) {
    for (const name of ["href", "xlink:href"]) {
      const value = element.getAttribute(name)
      if (!value?.startsWith("#")) continue
      const id = value.slice(1)
      if (idOwners.has(id) && !renamedIds.has(id)) {
        cloneSequence += 1
        renamedIds.set(id, `${id}-rf-atom-${cloneSequence}`)
      }
    }
  }

  for (const element of elements) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase()
      if (name === "id") {
        const renamed = renamedIds.get(attribute.value)
        if (renamed) {
          element.setAttribute("id", renamed)
        } else {
          element.removeAttributeNode(attribute)
        }
        continue
      }
      if (REMOVED_ATTRIBUTE_NAMES.has(name) || name.startsWith("on")) {
        element.removeAttributeNode(attribute)
        continue
      }
      if (URL_ATTRIBUTE_NAMES.has(name)) {
        if (UNSAFE_URL_RE.test(attribute.value)) {
          element.removeAttributeNode(attribute)
        } else if (attribute.value.startsWith("#")) {
          const renamed = renamedIds.get(attribute.value.slice(1))
          if (renamed) element.setAttribute(attribute.name, `#${renamed}`)
        }
      }
    }
  }

  clone.classList.add(INLINE_ATOM_CLASS, ...TYPESET_IGNORE_CLASSES)
  clone.setAttribute("translate", "no")
  // The original formula directly above stays the accessible copy.
  clone.setAttribute("aria-hidden", "true")
  clone.setAttribute("role", "presentation")
  // Math renders left-to-right even inside an RTL translation.
  if (!clone.hasAttribute("dir")) clone.setAttribute("dir", "ltr")
  return clone
}

/**
 * Rebuild the translated span from the provider's text: literal runs become
 * text nodes and every placeholder becomes a clone of its atom, in the order
 * the target language put them. Tolerates what providers do to placeholders:
 * a repeated index renders once (first wins), an index we never issued stays
 * as literal text (never eat page content), and atoms whose placeholder was
 * dropped are appended after the text so the formula is never lost.
 */
export function renderInlineAtomTranslation(
  container: HTMLElement,
  translatedText: string,
  extraction: Pick<InlineAtomExtraction, "atoms" | "baseIndex">,
): void {
  const { atoms, baseIndex } = extraction
  const ownerDoc = container.ownerDocument
  const fragment = ownerDoc.createDocumentFragment()
  const inserted = new Set<number>()

  for (const part of decodeInlineAtomTokens(translatedText)) {
    if (part.kind === "text") {
      fragment.append(ownerDoc.createTextNode(part.text))
      continue
    }
    const atomIndex = part.index - baseIndex
    const source = atomIndex >= 0 && atomIndex < atoms.length ? atoms[atomIndex] : undefined
    if (!source) {
      fragment.append(ownerDoc.createTextNode(part.raw))
      continue
    }
    if (inserted.has(atomIndex)) continue
    inserted.add(atomIndex)
    fragment.append(sanitizeInlineAtomClone(source))
  }

  const missing = atoms.map((_, index) => index).filter((index) => !inserted.has(index))
  if (missing.length > 0) {
    logger.warn(
      `[inline-atoms] translation dropped ${missing.length} placeholder(s); appending the formulas`,
    )
    for (const index of missing) {
      fragment.append(ownerDoc.createTextNode(" "))
      fragment.append(sanitizeInlineAtomClone(atoms[index]!))
    }
  }

  container.replaceChildren(fragment)
}

/**
 * Whether `root` holds a renderable atom that is host content (clones inside
 * our own wrappers never count). Used to keep atom-bearing containers off the
 * virtual-paragraph path, whose unit texts cannot carry placeholders.
 */
export function containsInlineAtomOutsideWrappers(root: HTMLElement, config: Config): boolean {
  const { atomSelector } = getEffectiveSiteRule(config, window.location.href)
  const selector = atomSelector ? `math,${atomSelector}` : "math"
  for (const element of root.querySelectorAll<HTMLElement>(selector)) {
    if (element.closest(`.${CONTENT_WRAPPER_CLASS}`) !== null) continue
    if (isRenderableInlineAtom(element)) return true
  }
  return false
}
