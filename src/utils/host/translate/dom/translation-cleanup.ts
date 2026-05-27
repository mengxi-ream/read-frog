import { REACT_SHADOW_HOST_CLASS, TRANSLATION_MODE_ATTRIBUTE, WALKED_ATTRIBUTE } from "../../../constants/dom-labels"
import { removeReactShadowHost } from "../../../react-shadow-host/create-shadow-host"
import { batchDOMOperation } from "../../dom/batch-dom"
import { isHTMLElement, isTranslatedWrapperNode } from "../../dom/filter"
import { deepQueryTopLevelSelector } from "../../dom/find"
import { originalContentMap } from "../core/translation-state"

export function removeShadowHostInTranslatedWrapper(wrapper: HTMLElement): void {
  // Remove React shadow hosts (for error components)
  const translationShadowHost = wrapper.querySelector(`.${REACT_SHADOW_HOST_CLASS}`)
  if (translationShadowHost && isHTMLElement(translationShadowHost)) {
    removeReactShadowHost(translationShadowHost)
  }

  // Remove lightweight spinners
  const spinner = wrapper.querySelector(".read-frog-spinner")
  if (spinner) {
    batchDOMOperation(() => spinner.remove())
  }
}

/**
 * Remove translated wrapper and restore original content based on translation mode
 * @param wrapper - The translated wrapper element to remove
 */
export function removeTranslatedWrapperWithRestore(wrapper: HTMLElement): void {
  removeShadowHostInTranslatedWrapper(wrapper)

  const translationMode = wrapper.getAttribute(TRANSLATION_MODE_ATTRIBUTE)

  if (translationMode === "translationOnly") {
    // For translation-only mode, find nearest ancestor in originalContentMap and restore
    let currentNode = wrapper.parentNode

    while (currentNode && isHTMLElement(currentNode)) {
      const originalContent = originalContentMap.get(currentNode)
      if (originalContent) {
        const nodeToRestore = currentNode
        batchDOMOperation(() => {
          nodeToRestore.innerHTML = originalContent
        })
        originalContentMap.delete(currentNode)
        return
      }
      currentNode = currentNode.parentNode
    }
  }

  // For bilingual mode or when no original content is found, just remove the wrapper
  batchDOMOperation(() => wrapper.remove())
}

export function removeAllTranslatedWrapperNodes(
  root: Document | ShadowRoot = document,
): void {
  const translatedNodes = deepQueryTopLevelSelector(root, isTranslatedWrapperNode)
  translatedNodes.forEach((contentWrapperNode) => {
    removeTranslatedWrapperWithRestore(contentWrapperNode)
  })

  // Also clean up line-by-line translated paragraphs — they don't have
  // wrapper elements; their innerHTML was replaced in-place.
  const lineByLineParas = deepQueryTopLevelSelector(
    root,
    el => isHTMLElement(el) && el.getAttribute(TRANSLATION_MODE_ATTRIBUTE) === "lineByLine",
  )
  for (const para of lineByLineParas) {
    if (!isHTMLElement(para))
      continue
    const saved = originalContentMap.get(para)
    if (saved !== undefined) {
      para.innerHTML = saved
      originalContentMap.delete(para)
    }
    para.removeAttribute(TRANSLATION_MODE_ATTRIBUTE)
    para.removeAttribute(WALKED_ATTRIBUTE)
  }
}
