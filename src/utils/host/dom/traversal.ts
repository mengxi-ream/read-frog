import type { Config } from "@/types/config/config"
import type { TransNode } from "@/types/dom"
import {
  BLOCK_ATTRIBUTE,
  INLINE_ATTRIBUTE,
  PARAGRAPH_ATTRIBUTE,
  WALKED_ATTRIBUTE,
} from "@/utils/constants/dom-labels"
import { DEFAULT_WALK_BUDGET_MS, yieldToMain } from "@/utils/scheduler"
import {
  getEffectiveTagSet,
  isDontWalkIntoAndDontTranslateAsChildElement,
  isHTMLElement,
  isShallowBlockHTMLElement,
  isShallowInlineHTMLElement,
  isSiteRuleForceBlockNodeElement,
  isSiteRuleForceInlineNodeElement,
  isTextNode,
  isTranslatedWrapperNode,
  isWalkBlockedElement,
  isWithinIncludeScope,
  setNaturalTransNodeKind,
} from "./filter"

const NON_NEWLINE_WHITESPACE_RE = /[^\S\n]/

export function extractTextContent(node: TransNode, config: Config): string {
  if (isTextNode(node)) {
    const text = node.textContent ?? ""
    const trimmed = text.trim()
    if (trimmed === "") return " "
    const leadingWs = text.slice(0, text.length - text.trimStart().length)
    const trailingWs = text.slice(text.trimEnd().length)
    const hasLeading = NON_NEWLINE_WHITESPACE_RE.test(leadingWs)
    const hasTrailing = NON_NEWLINE_WHITESPACE_RE.test(trailingWs)
    return (hasLeading ? " " : "") + trimmed + (hasTrailing ? " " : "")
  }

  // Handle <br> elements as line breaks
  if (isHTMLElement(node) && node.tagName === "BR") {
    return "\n"
  }

  // We already don't walk and label the element which isDontWalkIntoElement
  // for the parent element we already walk and label, if we have a notranslate element inside this parent element,
  // we should extract the text content of the parent.
  // see this issue: https://github.com/mengxi-ream/read-frog/issues/249
  // if (isDontWalkIntoButTranslateAsChildElement(node)) {
  //   return ''
  // }

  // Extension-injected translation wrappers must never feed back into the
  // source text (issue #1831 retranslation storm). Host `notranslate` elements
  // stay included per issue #249 above — only our own wrappers are skipped.
  if (isTranslatedWrapperNode(node)) {
    return ""
  }

  if (isDontWalkIntoAndDontTranslateAsChildElement(node, config)) {
    return ""
  }

  const childNodes = [...node.childNodes]
  return childNodes.reduce((text: string, child: Node): string => {
    // TODO: support SVGElement in the future
    if (isTextNode(child) || isHTMLElement(child)) {
      return text + extractTextContent(child, config)
    }
    return text
  }, "")
}

export interface WalkResult {
  forceBlock: boolean
  isInlineNode: boolean
}

export interface WalkCallbacks {
  /** Invoked for each element the walk refuses to descend into. */
  onBlockedElement?: (element: HTMLElement) => void
}

export interface ChunkedWalkOptions extends WalkCallbacks {
  budgetMs?: number
  /** Checked at every slice boundary; returning false aborts the walk. */
  shouldContinue?: () => boolean
}

const SKIPPED_WALK_RESULT: WalkResult = { forceBlock: false, isInlineNode: false }

/**
 * Recursive generator holding the single copy of the labeling logic. Each
 * `yield` (one per element, BEFORE any attribute write) is a potential pause
 * point for the chunked driver; `yield*` delegation preserves the post-order
 * dataflow (a parent's paragraph label depends on every child's isInlineNode,
 * and forceBlock propagates child → parent).
 *
 * Precondition: `element` already passed the blocked check.
 */
function* walkNode(
  element: HTMLElement,
  walkId: string,
  config: Config,
  callbacks: WalkCallbacks,
): Generator<void, WalkResult> {
  yield

  element.setAttribute(WALKED_ATTRIBUTE, walkId)

  if (element.shadowRoot) {
    // Snapshot the live HTMLCollection: the chunked driver yields between
    // elements, and a page mutation during a pause could otherwise shift the
    // collection and skip an unvisited sibling (which no mutation record would
    // repair, since observers do not pierce the shadow boundary).
    for (const child of [...element.shadowRoot.children]) {
      if (!isHTMLElement(child)) continue
      if (isWalkBlockedElement(child, config)) {
        callbacks.onBlockedElement?.(child)
        continue
      }
      yield* walkNode(child, walkId, config, callbacks)
    }
  }

  let hasInlineNodeChild = false
  let forceBlock = false

  for (const child of [...element.childNodes]) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.textContent?.trim()) {
        hasInlineNodeChild = true
      }
      continue
    }

    if (isHTMLElement(child)) {
      // Evaluate the blocked predicate once per child, here — the recursive
      // call's precondition replaces the old duplicate entry re-check.
      if (isWalkBlockedElement(child, config)) {
        callbacks.onBlockedElement?.(child)
        continue
      }

      const result = yield* walkNode(child, walkId, config, callbacks)

      forceBlock = forceBlock || result.forceBlock

      if (result.isInlineNode) {
        hasInlineNodeChild = true
      }
    }
  }

  // The document root must never become a paragraph unit. Walks now start at
  // documentElement (#1991), and an inline-level child beside <body> — any
  // unstyled custom element or stray text node injected under <html> defaults
  // to display:inline — would otherwise label <html> itself as ONE paragraph.
  // That collapses the whole document into a single observed unit: viewport
  // gating dies (<html> always intersects), and the translated-region guard's
  // querySelector becomes a document-wide match that can silently skip the
  // entire page. Element-level injections still translate via their own
  // paragraph labels; only bare text nodes directly under <html> (impossible
  // to author in HTML, script-only) are left untranslated.
  if (
    hasInlineNodeChild &&
    element !== element.ownerDocument.documentElement &&
    isWithinIncludeScope(element, config)
  ) {
    element.setAttribute(PARAGRAPH_ATTRIBUTE, "")
  }

  // force block will force the current and ancestor elements to be block node
  forceBlock = forceBlock || getEffectiveTagSet(config, "forceBlockTags").has(element.tagName)

  if (element.textContent?.trim() === "" && !forceBlock) {
    setNaturalTransNodeKind(element, "none")
    return {
      forceBlock: false,
      isInlineNode: false,
    }
  }

  // One computed-style resolution feeds both shallow-shape checks (was up to
  // four separate getComputedStyle calls per element, #1881).
  const computedStyle = window.getComputedStyle(element)
  const naturalBlockNode = forceBlock || isShallowBlockHTMLElement(element, computedStyle, config)
  const naturalInlineNode =
    !naturalBlockNode && isShallowInlineHTMLElement(element, computedStyle, config)
  setNaturalTransNodeKind(
    element,
    naturalBlockNode ? "block" : naturalInlineNode ? "inline" : "none",
  )

  const siteRuleForceBlockNode = isSiteRuleForceBlockNodeElement(element, config)
  const siteRuleForceInlineNode =
    !forceBlock && !siteRuleForceBlockNode && isSiteRuleForceInlineNodeElement(element, config)
  const isBlockNode =
    forceBlock || siteRuleForceBlockNode || (!siteRuleForceInlineNode && naturalBlockNode)
  const isInlineNode = !isBlockNode && (siteRuleForceInlineNode || naturalInlineNode)

  if (isBlockNode) {
    element.setAttribute(BLOCK_ATTRIBUTE, "")
  } else if (isInlineNode) {
    element.setAttribute(INLINE_ATTRIBUTE, "")
  }

  return {
    forceBlock,
    isInlineNode,
  }
}

export function walkAndLabelElement(
  element: HTMLElement,
  walkId: string,
  config: Config,
  callbacks: WalkCallbacks = {},
): WalkResult {
  if (isWalkBlockedElement(element, config)) {
    callbacks.onBlockedElement?.(element)
    return SKIPPED_WALK_RESULT
  }

  const iterator = walkNode(element, walkId, config, callbacks)
  let step = iterator.next()
  while (!step.done) {
    step = iterator.next()
  }
  return step.value
}

/**
 * Time-sliced variant of walkAndLabelElement: labels identically, but yields
 * to the main thread whenever a slice's budget is spent so input and
 * rendering stay responsive on huge pages (#1881). Returns `null` when
 * aborted via `shouldContinue`. The generator suspends at element ENTRY
 * (before any attribute write), so an abort never leaves a half-labeled
 * element — the frontier element is simply unwalked.
 */
export async function walkAndLabelElementChunked(
  element: HTMLElement,
  walkId: string,
  config: Config,
  options: ChunkedWalkOptions = {},
): Promise<WalkResult | null> {
  const { budgetMs = DEFAULT_WALK_BUDGET_MS, shouldContinue = () => true, ...callbacks } = options

  if (!shouldContinue()) return null
  if (isWalkBlockedElement(element, config)) {
    callbacks.onBlockedElement?.(element)
    return SKIPPED_WALK_RESULT
  }

  const iterator = walkNode(element, walkId, config, callbacks)
  let deadline = performance.now() + budgetMs
  let step = iterator.next()
  while (!step.done) {
    if (performance.now() >= deadline) {
      await yieldToMain()
      if (!shouldContinue()) return null
      deadline = performance.now() + budgetMs
    }
    step = iterator.next()
  }
  return step.value
}

/**
 * Text counts as prose only when it contains a letter. Deliberately NARROWER
 * than the `.trim()` test walkNode itself uses above: a stray "·", "|", "—" or
 * a bare "2026-08-17" sitting between two block children is not text a reader
 * would miss, and treating it as prose would forfeit viewport gating on
 * exactly the flat containers #1881 was about. `\p{L}` covers Han/Hiragana/
 * Hangul and subsumes isNumericContent, whose /^[\d\s,.-]+$/ admits no letter.
 */
const OWN_PROSE_RE = /\p{L}/u

/**
 * Giant-paragraph split guard — the CONTENT counterpart to
 * `canSplitParagraphIntoDescendants`, which guards paragraph STRUCTURE.
 *
 * Splitting a giant observes its descendant paragraphs INSIDE what is really
 * one translation unit. That is free on docs.docker.com (a 203k-px <article>
 * whose own direct text is ZERO chars) and catastrophic on a Blogger post body
 * or paulgraham.com (a flat <br>-delimited container whose only labeled
 * descendants are inline <i>/<span>/<a> fragments — 8% and 1.1% of the article
 * respectively; the rest is bare text nodes that belong to no observed unit
 * and are never enqueued, while the <i> gets its own translation inserted
 * mid-sentence).
 *
 * Only DIRECT text children can be stranded. By the labeling rule above, any
 * element with a non-whitespace direct text child is itself labeled a
 * paragraph, so every deeper text node already lies inside one of the chosen
 * units. One loop over childNodes is therefore complete — and structurally
 * blind to <script>, <style>, <pre>, hidden subtrees and our own translation
 * wrappers, none of which can be a bare Text child.
 *
 * The refusal additionally requires a block-labeled child, i.e. that
 * translateWalkedElement will really take its run path and re-segment the
 * container. Without one it takes the single-node path and the whole giant
 * ships as ONE request — a single node is never split by length. Note this is
 * the MIRROR-OPPOSITE precondition to the pre-wrap clause in
 * `canSplitParagraphIntoDescendants`, which refuses only in the all-inline
 * shape; the two refusal domains are disjoint by construction.
 */
export function canSplitGiantWithoutStrandingOwnText(element: HTMLElement): boolean {
  let hasOwnProse = false
  let hasBlockChild = false

  for (const child of element.childNodes) {
    // nodeType directly, matching walkNode above — this predicate runs inside
    // the observation gate, where the filter module may be stubbed out.
    if (child.nodeType === Node.TEXT_NODE) {
      if (!hasOwnProse && OWN_PROSE_RE.test(child.textContent ?? "")) {
        hasOwnProse = true
      }
      continue
    }
    if (!hasBlockChild && isHTMLElement(child) && child.hasAttribute(BLOCK_ATTRIBUTE)) {
      hasBlockChild = true
    }
    if (hasOwnProse && hasBlockChild) return false
  }

  return !(hasOwnProse && hasBlockChild)
}
