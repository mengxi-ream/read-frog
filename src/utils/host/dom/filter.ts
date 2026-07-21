import type { Config } from "@/types/config/config"
import type { TransNode } from "@/types/dom"
import {
  BLOCK_ATTRIBUTE,
  BLOCK_CONTENT_CLASS,
  CONTENT_WRAPPER_CLASS,
  INLINE_ATTRIBUTE,
  INLINE_CONTENT_CLASS,
  NOTRANSLATE_CLASS,
} from "@/utils/constants/dom-labels"
import {
  DONT_WALK_AND_TRANSLATE_TAGS,
  DONT_WALK_BUT_TRANSLATE_TAGS,
  FORCE_BLOCK_TAGS,
  MAIN_CONTENT_IGNORE_TAGS,
} from "@/utils/constants/dom-rules"
import { getEffectiveSiteRule } from "@/utils/site-rules/effective"

export function isEditable(element: HTMLElement): boolean {
  const tag = element.tagName
  if (tag === "INPUT" || tag === "TEXTAREA") return true
  if (element.isContentEditable) return true
  return false
}

// shallow means only check the node itself, not the children
// if a shallow inline node has children are block node, then it's block node rather than inline node
export function isShallowInlineTransNode(node: Node): boolean {
  if (isTextNode(node) && node.textContent?.trim()) {
    return true
  } else if (isHTMLElement(node)) {
    return isShallowInlineHTMLElement(node)
  }
  return false
}

// treat large floating letter on some news websites as inline node
// for example: https://www.economist.com/business/2025/08/21/china-is-quietly-upstaging-america-with-its-open-models
function isLargeInitialFloatingLetter(
  element: HTMLElement,
  computedStyle: CSSStyleDeclaration = window.getComputedStyle(element),
): boolean {
  return (
    computedStyle.float === "left" &&
    !!element.nextSibling &&
    isShallowInlineTransNode(element.nextSibling)
  )
}

function isInlineDisplay(display: string): boolean {
  const normalizedDisplay = display.trim().toLowerCase()

  if (!normalizedDisplay) {
    return false
  }

  if (normalizedDisplay.startsWith("inline")) {
    return true
  }

  return ["ruby", "ruby-base", "ruby-text", "ruby-base-container", "ruby-text-container"].includes(
    normalizedDisplay,
  )
}

export function isShallowInlineHTMLElement(
  element: HTMLElement,
  computedStyle?: CSSStyleDeclaration,
): boolean {
  // to prevent too many inline nodes that make <body> as a paragraph node
  if (!element.textContent?.trim()) {
    return false
  }

  if (FORCE_BLOCK_TAGS.has(element.tagName)) {
    return false
  }

  const style = computedStyle ?? window.getComputedStyle(element)

  if (isLargeInitialFloatingLetter(element, style)) {
    return true
  }

  return isInlineDisplay(style.display)
}

// Note: !(inline node) != block node because of `notranslate` class and all cases not in the if else block
export function isShallowBlockTransNode(node: Node): boolean {
  if (isTextNode(node)) {
    return false
  } else if (isHTMLElement(node)) {
    return isShallowBlockHTMLElement(node)
  }
  return false
}

export function isShallowBlockHTMLElement(
  element: HTMLElement,
  computedStyle?: CSSStyleDeclaration,
): boolean {
  if (FORCE_BLOCK_TAGS.has(element.tagName)) {
    return true
  }

  const style = computedStyle ?? window.getComputedStyle(element)

  if (isLargeInitialFloatingLetter(element, style)) {
    return false
  }

  return !isInlineDisplay(style.display)
}

export function isSiteRuleExcludedElement(element: HTMLElement, config: Config): boolean {
  const { excludeSelector, includeSelector } = getEffectiveSiteRule(config, window.location.href)
  if (excludeSelector === null || !element.matches(excludeSelector)) {
    return false
  }
  if (includeSelector !== null) {
    // An element matching an include selector is re-included even when it also
    // matches an exclude selector. Rule data relies on this priority: e.g. the
    // github rule excludes `a[data-hovercard-type]` broadly, then whitelists
    // `a[data-hovercard-type='issue']` to bring issue titles back.
    if (element.matches(includeSelector)) {
      return false
    }
    // A nested include target does not reopen an excluded subtree. Traversal
    // stops at this element, so its descendants remain excluded as well.
  }
  return true
}

export function isSiteRuleForceBlockNodeElement(element: HTMLElement, config: Config): boolean {
  const { forceBlockNodeSelector } = getEffectiveSiteRule(config, window.location.href)
  return forceBlockNodeSelector !== null && element.matches(forceBlockNodeSelector)
}

export function isSiteRuleForceBlockStyleElement(element: HTMLElement, config: Config): boolean {
  const { forceBlockStyleSelector } = getEffectiveSiteRule(config, window.location.href)
  return forceBlockStyleSelector !== null && element.matches(forceBlockStyleSelector)
}

export function isSiteRuleForceInlineNodeElement(element: HTMLElement, config: Config): boolean {
  const { forceInlineNodeSelector } = getEffectiveSiteRule(config, window.location.href)
  return forceInlineNodeSelector !== null && element.matches(forceInlineNodeSelector)
}

export function isSiteRuleForceInlineStyleElement(element: HTMLElement, config: Config): boolean {
  const { forceInlineStyleSelector } = getEffectiveSiteRule(config, window.location.href)
  return forceInlineStyleSelector !== null && element.matches(forceInlineStyleSelector)
}

export function isSiteRulePreserveTextElement(element: HTMLElement, config: Config): boolean {
  const { preserveTextSelector } = getEffectiveSiteRule(config, window.location.href)
  return preserveTextSelector !== null && element.matches(preserveTextSelector)
}

/**
 * Whitelist gate: when the effective site rule declares `includeSelectors`,
 * only elements inside (or matching) one of them may become translation
 * paragraphs. Rules without `includeSelectors` include everything.
 *
 * Note: exclusion wins unless the excluded element itself also matches an
 * include selector (see isSiteRuleExcludedElement) — exclude selectors can
 * still carve holes inside included regions.
 */
export function isWithinIncludeScope(element: HTMLElement, config: Config): boolean {
  const { includeSelector } = getEffectiveSiteRule(config, window.location.href)
  return includeSelector === null || element.closest(includeSelector) !== null
}

export function isDontWalkIntoButTranslateAsChildElement(
  element: HTMLElement,
  config?: Config,
): boolean {
  const dontWalkClass = element.classList.contains(NOTRANSLATE_CLASS)

  const dontWalkTag = DONT_WALK_BUT_TRANSLATE_TAGS.has(element.tagName)

  const dontWalkPreserveText =
    config !== undefined && isSiteRulePreserveTextElement(element, config)

  // issue: https://github.com/mengxi-ream/read-frog/issues/459
  // const dontWalkAttr = element.getAttribute('translate') === 'no'

  return dontWalkClass || dontWalkTag || dontWalkPreserveText
}

// https://github.com/mengxi-ream/read-frog/issues/940
function isInsideContentContainer(element: HTMLElement): boolean {
  let current: HTMLElement | null = element.parentElement
  while (current) {
    if (current.tagName === "ARTICLE" || current.tagName === "MAIN") {
      return true
    }
    current = current.parentElement
  }
  return false
}

export function isDontWalkIntoAndDontTranslateAsChildElement(
  element: HTMLElement,
  config: Config,
): boolean {
  // Cheap structural predicates first; the getComputedStyle check runs last
  // because it can force a style recalculation, and the full-page walk
  // evaluates this predicate for every element (#1881).
  const dontWalkInvalidTag = DONT_WALK_AND_TRANSLATE_TAGS.has(element.tagName)
  if (dontWalkInvalidTag) return true

  const dontWalkHidden = element.hidden
  if (dontWalkHidden) return true

  const dontWalkVisuallyHidden = ["sr-only", "visually-hidden"].some((cls) =>
    element.classList.contains(cls),
  )
  if (dontWalkVisuallyHidden) return true

  const dontWalkContent =
    config.translate.page.range !== "all" &&
    MAIN_CONTENT_IGNORE_TAGS.has(element.tagName) &&
    !isInsideContentContainer(element)
  if (dontWalkContent) return true

  const dontWalkCustomElement =
    !isDontWalkIntoButTranslateAsChildElement(element, config) &&
    isSiteRuleExcludedElement(element, config)
  if (dontWalkCustomElement) return true

  const computedStyle = window.getComputedStyle(element)
  return computedStyle.display === "none" || computedStyle.visibility === "hidden"
}

/**
 * The walk-blocking predicate shared by the traversal (which stops descent at
 * such elements) and the mutation pipeline's walkability cache.
 */
export function isWalkBlockedElement(element: HTMLElement, config: Config): boolean {
  return (
    isDontWalkIntoButTranslateAsChildElement(element, config) ||
    isDontWalkIntoAndDontTranslateAsChildElement(element, config)
  )
}

export function isInlineTransNode(node: TransNode): boolean {
  if (isTextNode(node)) {
    return true
  }
  return node.hasAttribute(INLINE_ATTRIBUTE)
}

export function isBlockTransNode(node: TransNode): boolean {
  if (isTextNode(node)) {
    return false
  }
  return node.hasAttribute(BLOCK_ATTRIBUTE)
}

type NaturalTransNodeKind = "block" | "inline" | "none"

// Traversal labels are the effective node classification after site-rule
// overrides. Keep the pre-override classification separately so translation
// wrapper layout never reads a Node-only override as a Style instruction.
// WeakMap avoids exposing another marker attribute to host-page CSS and
// mutation observers. Marker-only fallback covers retry/tests whose labels
// predate this module state (for example, an extension reload on a live tab).
const naturalTransNodeKinds = new WeakMap<HTMLElement, NaturalTransNodeKind>()

export function setNaturalTransNodeKind(element: HTMLElement, kind: NaturalTransNodeKind): void {
  naturalTransNodeKinds.set(element, kind)
}

export function isNaturalInlineTransNode(node: TransNode): boolean {
  if (isTextNode(node)) {
    return true
  }
  const kind = naturalTransNodeKinds.get(node)
  return kind === undefined ? isInlineTransNode(node) : kind === "inline"
}

export function isNaturalBlockTransNode(node: TransNode): boolean {
  if (isTextNode(node)) {
    return false
  }
  const kind = naturalTransNodeKinds.get(node)
  return kind === undefined ? isBlockTransNode(node) : kind === "block"
}

/**
 * More reliable check for HTML elements that works across different contexts (iframe, shadow DOM)
 * avoid using instanceof HTMLElement
 * @param node - The node to check
 * @returns Whether the node is an HTML element
 */
export function isHTMLElement(node: Node): node is HTMLElement {
  return (
    node.nodeType === Node.ELEMENT_NODE &&
    node.nodeName !== undefined &&
    "tagName" in node &&
    "getAttribute" in node &&
    "setAttribute" in node
  )
}

export function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE
}

/**
 * More reliable check for Text nodes that works across different contexts
 * avoid using instanceof Text
 * @param node - The node to check
 * @returns Whether the node is a Text node
 */
export function isTextNode(node: Node): node is Text {
  return node.nodeType === Node.TEXT_NODE && "textContent" in node && "data" in node
}

export function isTransNode(node: Node): node is TransNode {
  return isHTMLElement(node) || isTextNode(node)
}

export function isIFrameElement(node: Node): node is HTMLIFrameElement {
  return node.nodeType === Node.ELEMENT_NODE && node.nodeName === "IFRAME"
}

export function isTranslatedWrapperNode(node: Node) {
  return isHTMLElement(node) && node.classList.contains(CONTENT_WRAPPER_CLASS)
}

/**
 * Check if a node is translated content (block or inline)
 */
export function isTranslatedContentNode(node: Node): boolean {
  return (
    isHTMLElement(node) &&
    (node.classList.contains(BLOCK_CONTENT_CLASS) || node.classList.contains(INLINE_CONTENT_CLASS))
  )
}

/**
 * Check if an element has an ancestor that should not be walked into
 */
export function hasNoWalkAncestor(element: HTMLElement, config: Config): boolean {
  let current: HTMLElement | null = element.parentElement
  while (current) {
    if (isWalkBlockedElement(current, config)) {
      return true
    }
    current = current.parentElement
  }
  return false
}
