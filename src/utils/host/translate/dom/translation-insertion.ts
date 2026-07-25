import type { Config } from "@/types/config/config"
import type { TranslationNodeStyleConfig } from "@/types/config/translate"
import type { TransNode } from "@/types/dom"
import { getEffectiveSiteRule } from "@/utils/site-rules/effective"
import {
  BLOCK_CONTENT_CLASS,
  FLOAT_WRAP_ATTRIBUTE,
  INLINE_CONTENT_CLASS,
  NOTRANSLATE_CLASS,
  PARAGRAPH_ATTRIBUTE,
} from "../../../constants/dom-labels"
import { isHTMLElement, isNaturalBlockTransNode, isNaturalInlineTransNode } from "../../dom/filter"
import { getOwnerDocument } from "../../dom/node"
import { decorateTranslationNode } from "../ui/decorate-translation"
import { isForceInlineTranslation, isShortInlineTranslationText } from "../ui/translation-utils"

interface TranslationInsertionContext {
  flowSource: TransNode
  layoutSource: TransNode
  /** Nodes whose source text is represented by this wrapper. */
  styleSources?: readonly TransNode[]
  sourceText: string
  isCurrent?: () => boolean
  // Fired synchronously right after the translated node is appended, BEFORE
  // the decorate await. This is the only sound point to snapshot the wrapper's
  // expected content (#1918): earlier and the isCurrent() entry guard would
  // see a mismatch and self-destruct the translation; later (after the await)
  // and a site rewrite landing in the await window would be canonized as the
  // expected content. Not fired on the no-append early return, so stray empty
  // wrappers never enter tamper surveillance.
  onContentInserted?: (wrapper: HTMLElement) => void
}

function sourceRunMatchesSelector(sources: readonly TransNode[], selector: string | null): boolean {
  if (selector === null) return false

  return sources.some((source) => {
    const element = isHTMLElement(source) ? source : source.parentElement
    return element?.matches(selector) ?? false
  })
}

function isFloatedElement(element: HTMLElement): boolean {
  const floatValue = window.getComputedStyle(element).float
  return floatValue === "left" || floatValue === "right"
}

function hasVisibleLayoutBox(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function findActiveFloatSibling(paragraphElement: HTMLElement): HTMLElement | null {
  const flowContainer = paragraphElement.parentElement
  if (!flowContainer) return null

  const paragraphRect = paragraphElement.getBoundingClientRect()

  for (const sibling of flowContainer.children) {
    if (!isHTMLElement(sibling)) continue
    if (sibling === paragraphElement || sibling.contains(paragraphElement)) continue

    const floatCandidates = [sibling, ...sibling.querySelectorAll<HTMLElement>("*")]
    for (const candidate of floatCandidates) {
      if (!isFloatedElement(candidate) || !hasVisibleLayoutBox(candidate)) continue

      const floatRect = candidate.getBoundingClientRect()
      const verticallyAffectsParagraph =
        paragraphRect.top < floatRect.bottom - 1 && paragraphRect.bottom > floatRect.top + 1
      if (verticallyAffectsParagraph) return candidate
    }
  }

  return null
}

function shouldWrapInsideFloatFlow(targetNode: TransNode): boolean {
  const paragraphElement = isHTMLElement(targetNode)
    ? targetNode.hasAttribute(PARAGRAPH_ATTRIBUTE)
      ? targetNode
      : targetNode.closest<HTMLElement>(`[${PARAGRAPH_ATTRIBUTE}]`)
    : targetNode.parentElement?.closest<HTMLElement>(`[${PARAGRAPH_ATTRIBUTE}]`)
  if (!paragraphElement) return false

  const activeFloat = findActiveFloatSibling(paragraphElement)
  return !!activeFloat
}

export function addInlineTranslation(
  ownerDoc: Document,
  translatedWrapperNode: HTMLElement,
  translatedNode: HTMLElement,
): void {
  const spaceNode = ownerDoc.createElement("span")
  spaceNode.textContent = "\u00A0\u00A0"
  translatedWrapperNode.appendChild(spaceNode)
  translatedNode.className = `${NOTRANSLATE_CLASS} ${INLINE_CONTENT_CLASS}`
}

export function addBlockTranslation(
  ownerDoc: Document,
  translatedWrapperNode: HTMLElement,
  translatedNode: HTMLElement,
): void {
  const brNode = ownerDoc.createElement("br")
  translatedWrapperNode.appendChild(brNode)
  translatedNode.className = `${NOTRANSLATE_CLASS} ${BLOCK_CONTENT_CLASS}`
}

export async function insertTranslatedNodeIntoWrapper(
  translatedWrapperNode: HTMLElement,
  {
    flowSource,
    layoutSource,
    styleSources,
    sourceText,
    isCurrent,
    onContentInserted,
  }: TranslationInsertionContext,
  translatedText: string,
  translationNodeStyle: TranslationNodeStyleConfig,
  config: Config,
  forceBlockTranslation: boolean = false,
): Promise<void> {
  if (isCurrent && !isCurrent()) return

  // Use the wrapper's owner document
  const ownerDoc = getOwnerDocument(translatedWrapperNode)
  const translatedNode = ownerDoc.createElement("span")
  const layoutSourceDisplay = isHTMLElement(layoutSource)
    ? window.getComputedStyle(layoutSource).display
    : undefined
  const { forceBlockStyleSelector, forceInlineStyleSelector } = getEffectiveSiteRule(
    config,
    window.location.href,
  )
  const wrapperStyleSources = styleSources ?? [layoutSource]
  const siteRuleForceBlockStyle = sourceRunMatchesSelector(
    wrapperStyleSources,
    forceBlockStyleSelector,
  )
  const siteRuleForceInlineStyle = sourceRunMatchesSelector(
    wrapperStyleSources,
    forceInlineStyleSelector,
  )
  const forceInlineTranslation = isForceInlineTranslation(layoutSource, layoutSourceDisplay)
  const shortInlineTranslation =
    isShortInlineTranslationText(sourceText) && layoutSourceDisplay !== "contents"

  // Site style overrides are the explicit outer priority. Existing layout
  // heuristics and the pre-Node-override classification remain fallbacks
  // within that boundary, so Node-only rules cannot change wrapper styling.
  if (siteRuleForceBlockStyle) {
    addBlockTranslation(ownerDoc, translatedWrapperNode, translatedNode)
  } else if (siteRuleForceInlineStyle) {
    addInlineTranslation(ownerDoc, translatedWrapperNode, translatedNode)
  } else if (forceInlineTranslation) {
    addInlineTranslation(ownerDoc, translatedWrapperNode, translatedNode)
  } else if (forceBlockTranslation) {
    addBlockTranslation(ownerDoc, translatedWrapperNode, translatedNode)
  } else if (shortInlineTranslation) {
    addInlineTranslation(ownerDoc, translatedWrapperNode, translatedNode)
  } else if (isNaturalInlineTransNode(layoutSource)) {
    addInlineTranslation(ownerDoc, translatedWrapperNode, translatedNode)
  } else if (isNaturalBlockTransNode(layoutSource)) {
    addBlockTranslation(ownerDoc, translatedWrapperNode, translatedNode)
  } else {
    // not inline or block, maybe notranslate
    return
  }

  translatedNode.textContent = translatedText
  translatedWrapperNode.appendChild(translatedNode)
  // Synchronous, pre-await: see TranslationInsertionContext.onContentInserted.
  onContentInserted?.(translatedWrapperNode)
  await decorateTranslationNode(translatedNode, translationNodeStyle)

  if (isCurrent && !isCurrent()) return

  if (
    translatedNode.classList.contains(BLOCK_CONTENT_CLASS) &&
    shouldWrapInsideFloatFlow(flowSource)
  ) {
    translatedNode.setAttribute(FLOAT_WRAP_ATTRIBUTE, "true")
  }
}
