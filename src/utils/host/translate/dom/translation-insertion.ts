import type { TranslationNodeStyleConfig } from "@/types/config/translate"
import type { TransNode } from "@/types/dom"
import {
  BLOCK_CONTENT_CLASS,
  FLOAT_WRAP_ATTRIBUTE,
  INLINE_CONTENT_CLASS,
  NOTRANSLATE_CLASS,
  PARAGRAPH_ATTRIBUTE,
} from "../../../constants/dom-labels"
import { isBlockTransNode, isCustomForceBlockTranslation, isHTMLElement, isInlineTransNode } from "../../dom/filter"
import { getOwnerDocument } from "../../dom/node"
import { decorateTranslationNode } from "../ui/decorate-translation"
import { isForceInlineTranslation } from "../ui/translation-utils"

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
  if (!flowContainer)
    return null

  const paragraphRect = paragraphElement.getBoundingClientRect()

  for (const sibling of flowContainer.children) {
    if (!isHTMLElement(sibling))
      continue
    if (sibling === paragraphElement || sibling.contains(paragraphElement))
      continue

    const floatCandidates = [sibling, ...sibling.querySelectorAll<HTMLElement>("*")]
    for (const candidate of floatCandidates) {
      if (!isFloatedElement(candidate) || !hasVisibleLayoutBox(candidate))
        continue

      const floatRect = candidate.getBoundingClientRect()
      const verticallyAffectsParagraph = paragraphRect.top < floatRect.bottom - 1 && paragraphRect.bottom > floatRect.top + 1
      if (verticallyAffectsParagraph)
        return candidate
    }
  }

  return null
}

function shouldWrapInsideFloatFlow(targetNode: TransNode): boolean {
  const paragraphElement = isHTMLElement(targetNode)
    ? (targetNode.hasAttribute(PARAGRAPH_ATTRIBUTE) ? targetNode : targetNode.closest<HTMLElement>(`[${PARAGRAPH_ATTRIBUTE}]`))
    : targetNode.parentElement?.closest<HTMLElement>(`[${PARAGRAPH_ATTRIBUTE}]`)
  if (!paragraphElement)
    return false

  const activeFloat = findActiveFloatSibling(paragraphElement)
  return !!activeFloat
}

export function addInlineTranslation(ownerDoc: Document, translatedWrapperNode: HTMLElement, translatedNode: HTMLElement): void {
  const spaceNode = ownerDoc.createElement("span")
  spaceNode.textContent = "  "
  translatedWrapperNode.appendChild(spaceNode)
  translatedNode.className = `${NOTRANSLATE_CLASS} ${INLINE_CONTENT_CLASS}`
}

export function addBlockTranslation(ownerDoc: Document, translatedWrapperNode: HTMLElement, translatedNode: HTMLElement): void {
  const brNode = ownerDoc.createElement("br")
  translatedWrapperNode.appendChild(brNode)
  translatedNode.className = `${NOTRANSLATE_CLASS} ${BLOCK_CONTENT_CLASS}`
}

export async function insertTranslatedNodeIntoWrapper(
  translatedWrapperNode: HTMLElement,
  targetNode: TransNode,
  translatedText: string,
  translationNodeStyle: TranslationNodeStyleConfig,
  forceBlockTranslation: boolean = false,
): Promise<void> {
  // Use the wrapper's owner document
  const ownerDoc = getOwnerDocument(translatedWrapperNode)
  const translatedNode = ownerDoc.createElement("span")
  const forceInlineTranslation = isForceInlineTranslation(targetNode)
  const customForceBlock = isHTMLElement(targetNode) && isCustomForceBlockTranslation(targetNode)

  // priority: customForceBlock > forceInlineTranslation > forceBlockTranslation > isInlineTransNode > isBlockTransNode
  if (customForceBlock) {
    addBlockTranslation(ownerDoc, translatedWrapperNode, translatedNode)
  }
  else if (forceInlineTranslation) {
    addInlineTranslation(ownerDoc, translatedWrapperNode, translatedNode)
  }
  else if (forceBlockTranslation) {
    addBlockTranslation(ownerDoc, translatedWrapperNode, translatedNode)
  }
  else if (isInlineTransNode(targetNode)) {
    addInlineTranslation(ownerDoc, translatedWrapperNode, translatedNode)
  }
  else if (isBlockTransNode(targetNode)) {
    addBlockTranslation(ownerDoc, translatedWrapperNode, translatedNode)
  }
  else {
    // not inline or block, maybe notranslate
    return
  }

  translatedNode.textContent = translatedText
  translatedWrapperNode.appendChild(translatedNode)
  await decorateTranslationNode(translatedNode, translationNodeStyle)

  if (translatedNode.classList.contains(BLOCK_CONTENT_CLASS) && shouldWrapInsideFloatFlow(targetNode)) {
    translatedNode.setAttribute(FLOAT_WRAP_ATTRIBUTE, "true")
  }
}
