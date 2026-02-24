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
import { CUSTOM_DONT_WALK_INTO_ELEMENT_SELECTOR_MAP, CUSTOM_FORCE_BLOCK_TRANSLATION_SELECTOR_MAP, DONT_WALK_AND_TRANSLATE_TAGS, DONT_WALK_BUT_TRANSLATE_TAGS, FORCE_BLOCK_TAGS, MAIN_CONTENT_IGNORE_TAGS } from "@/utils/constants/dom-rules"

export function isEditable(element: HTMLElement): boolean {
  const tag = element.tagName
  if (tag === "INPUT" || tag === "TEXTAREA")
    return true
  if (element.isContentEditable)
    return true
  return false
}

// shallow means only check the node itself, not the children
// if a shallow inline node has children are block node, then it's block node rather than inline node
export function isShallowInlineTransNode(node: Node): boolean {
  if (isTextNode(node) && node.textContent?.trim()) {
    return true
  }
  else if (isHTMLElement(node)) {
    return isShallowInlineHTMLElement(node)
  }
  return false
}

// treat large floating letter on some news websites as inline node
// for example: https://www.economist.com/business/2025/08/21/china-is-quietly-upstaging-america-with-its-open-models
function isLargeInitialFloatingLetter(element: HTMLElement): boolean {
  const computedStyle = window.getComputedStyle(element)
  return computedStyle.float === "left" && !!element.nextSibling && isShallowInlineTransNode(element.nextSibling)
}

export function isShallowInlineHTMLElement(element: HTMLElement): boolean {
  // to prevent too many inline nodes that make <body> as a paragraph node
  if (!element.textContent?.trim()) {
    return false
  }

  if (FORCE_BLOCK_TAGS.has(element.tagName)) {
    return false
  }

  const computedStyle = window.getComputedStyle(element)

  if (isLargeInitialFloatingLetter(element)) {
    return true
  }

  const isInlineDisplay = ["inline", "contents"].some(display => computedStyle.display.includes(display))

  return isInlineDisplay
}

// Note: !(inline node) != block node because of `notranslate` class and all cases not in the if else block
export function isShallowBlockTransNode(node: Node): boolean {
  if (isTextNode(node)) {
    return false
  }
  else if (isHTMLElement(node)) {
    return isShallowBlockHTMLElement(node)
  }
  return false
}

export function isShallowBlockHTMLElement(element: HTMLElement): boolean {
  const computedStyle = window.getComputedStyle(element)

  if (FORCE_BLOCK_TAGS.has(element.tagName)) {
    return true
  }

  if (isLargeInitialFloatingLetter(element)) {
    return false
  }

  const isInlineDisplay = ["inline", "contents"].some(display => computedStyle.display.includes(display))

  return !isInlineDisplay
}

export function isCustomDontWalkIntoElement(element: HTMLElement): boolean {
  const dontWalkIntoElementSelectorList = CUSTOM_DONT_WALK_INTO_ELEMENT_SELECTOR_MAP[window.location.hostname] ?? []

  const dontWalkSelector = dontWalkIntoElementSelectorList.join(",")

  if (!dontWalkSelector)
    return false

  return element.matches(dontWalkSelector)
}

export function isCustomForceBlockTranslation(element: HTMLElement): boolean {
  const forceBlockSelectorList = CUSTOM_FORCE_BLOCK_TRANSLATION_SELECTOR_MAP[window.location.hostname] ?? []

  const forceBlockSelector = forceBlockSelectorList.join(",")

  if (!forceBlockSelector)
    return false

  return element.matches(forceBlockSelector)
}

export function isDontWalkIntoButTranslateAsChildElement(element: HTMLElement): boolean {
  const dontWalkClass = [NOTRANSLATE_CLASS, "sr-only"].some(className =>
    element.classList.contains(className),
  )

  const dontWalkTag = DONT_WALK_BUT_TRANSLATE_TAGS.has(element.tagName)

  // issue: https://github.com/mengxi-ream/read-frog/issues/459
  // const dontWalkAttr = element.getAttribute('translate') === 'no'

  return dontWalkClass || dontWalkTag
}

export function isDontWalkIntoAndDontTranslateAsChildElement(element: HTMLElement, config: Config): boolean {
  const dontWalkCustomElement = isCustomDontWalkIntoElement(element)
  const dontWalkContent = config.translate.page.range !== "all" && MAIN_CONTENT_IGNORE_TAGS.has(element.tagName)
  const dontWalkInvalidTag = DONT_WALK_AND_TRANSLATE_TAGS.has(element.tagName)
  const dontWalkCSS
    = window.getComputedStyle(element).display === "none"
      || window.getComputedStyle(element).visibility === "hidden"
  const dontWalkAriaHidden = element.getAttribute("aria-hidden") === "true"
  return dontWalkCustomElement || dontWalkContent || dontWalkInvalidTag || dontWalkCSS || dontWalkAriaHidden
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

/**
 * More reliable check for HTML elements that works across different contexts (iframe, shadow DOM)
 * avoid using instanceof HTMLElement
 * @param node - The node to check
 * @returns Whether the node is an HTML element
 */
export function isHTMLElement(node: Node): node is HTMLElement {
  return node.nodeType === Node.ELEMENT_NODE
    && node.nodeName !== undefined
    && "tagName" in node
    && "getAttribute" in node
    && "setAttribute" in node
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
  return node.nodeType === Node.TEXT_NODE
    && "textContent" in node
    && "data" in node
}

export function isTransNode(node: Node): node is TransNode {
  return isHTMLElement(node) || isTextNode(node)
}

export function isIFrameElement(node: Node): node is HTMLIFrameElement {
  return node.nodeType === Node.ELEMENT_NODE
    && node.nodeName === "IFRAME"
}

export function isTranslatedWrapperNode(node: Node) {
  return isHTMLElement(node) && node.classList.contains(CONTENT_WRAPPER_CLASS)
}

/**
 * Check if a node is translated content (block or inline)
 */
export function isTranslatedContentNode(node: Node): boolean {
  return isHTMLElement(node) && (node.classList.contains(BLOCK_CONTENT_CLASS) || node.classList.contains(INLINE_CONTENT_CLASS))
}

/**
 * Check if an element has an ancestor that should not be walked into
 */
export function hasNoWalkAncestor(element: HTMLElement, config: Config): boolean {
  let current: HTMLElement | null = element.parentElement
  while (current) {
    if (isDontWalkIntoButTranslateAsChildElement(current) || isDontWalkIntoAndDontTranslateAsChildElement(current, config)) {
      return true
    }
    current = current.parentElement
  }
  return false
}
