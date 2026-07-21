import type { TranslationActionContext } from "@/types/analytics"
import type { Config } from "@/types/config/config"
import type { WorkPacer } from "@/utils/scheduler"
import { createWorkPacer, pauseIfBudgetSpent } from "@/utils/scheduler"
import {
  BLOCK_ATTRIBUTE,
  CONTENT_WRAPPER_CLASS,
  PARAGRAPH_ATTRIBUTE,
  TRANSLATION_ONLY_ATTRIBUTE,
  WALKED_ATTRIBUTE,
} from "../../../constants/dom-labels"
import {
  isBlockTransNode,
  isHTMLElement,
  isNaturalBlockTransNode,
  isSiteRuleForceBlockStyleElement,
  isTextNode,
  isTransNode,
} from "../../dom/filter"
import { translateNodes } from "./translation-modes"
import { getTranslationOnlyAnchorState } from "./translation-state"

/**
 * Marker attributes can outlive their WeakMap state (extension reload on a
 * live tab). A ghost marker must not block walks forever — heal it and treat
 * the region as untranslated.
 */
function hasLiveTranslationOnlyAnchor(element: HTMLElement): boolean {
  const candidates: HTMLElement[] = element.hasAttribute(TRANSLATION_ONLY_ATTRIBUTE)
    ? [element]
    : []
  candidates.push(...element.querySelectorAll<HTMLElement>(`[${TRANSLATION_ONLY_ATTRIBUTE}]`))
  let live = false
  for (const candidate of candidates) {
    if (getTranslationOnlyAnchorState(candidate)) live = true
    else candidate.removeAttribute(TRANSLATION_ONLY_ATTRIBUTE)
  }
  return live
}

export async function translateWalkedElement(
  element: HTMLElement,
  walkId: string,
  config: Config,
  toggle: boolean = false,
  pacer: WorkPacer = createWorkPacer(),
  // Liveness gate re-checked after every yield. Because pacing spreads a giant
  // subtree's expansion across seconds, a session cancelled mid-expansion must
  // stop here — the WALKED attribute alone does not (stop() never strips it),
  // so without this the walk keeps inserting wrappers/spinners into the page
  // the user just cleared (#1881).
  shouldContinue: () => boolean = () => true,
  actionContext?: TranslationActionContext,
): Promise<void> {
  // Self-pacing: a giant observed subtree (a flat article can label as ONE
  // huge paragraph unit, #1881) must not expand into thousands of wrapper
  // insertions in a single task. Intersection-callback batches share one
  // pacer so a burst of entries is throttled globally.
  await pauseIfBudgetSpent(pacer)
  if (!shouldContinue()) return

  // Translated regions are skipped on non-toggle walks. In-place-swapped
  // paragraphs leave no wrapper, so also check the anchor marker attribute.
  if (
    !toggle &&
    (element.querySelector(`.${CONTENT_WRAPPER_CLASS}`) || hasLiveTranslationOnlyAnchor(element))
  ) {
    return
  }

  // if the walkId is not the same, return
  if (element.getAttribute(WALKED_ATTRIBUTE) !== walkId) return

  const promises: Promise<void>[] = []

  if (element.hasAttribute(PARAGRAPH_ATTRIBUTE)) {
    let hasBlockNodeChild = false
    let hasBlockLayoutChild = false

    for (const child of element.childNodes) {
      if (isHTMLElement(child)) {
        if (child.hasAttribute(BLOCK_ATTRIBUTE)) {
          hasBlockNodeChild = true
        }
        if (
          isNaturalBlockTransNode(child) ||
          (child.hasAttribute(BLOCK_ATTRIBUTE) && isSiteRuleForceBlockStyleElement(child, config))
        ) {
          hasBlockLayoutChild = true
        }
      }
    }

    const computedStyle = window.getComputedStyle(element)
    const isFlexParent = computedStyle.display.includes("flex")

    if (!hasBlockNodeChild) {
      promises.push(translateNodes([element], walkId, toggle, config, false, actionContext))
    } else {
      // prevent children change during iteration
      const children = [...element.childNodes]
      let consecutiveInlineNodes: ChildNode[] = []
      for (const child of children) {
        if (isTransNode(child) && isBlockTransNode(child) && !isTextNode(child)) {
          // A Node-only forced block may split the translation run without
          // changing wrapper layout. Natural block children and the combined
          // Node+Style shape produced by legacy force-block migration retain
          // the old group-level block wrapper hint.
          promises.push(
            translateNodes(
              consecutiveInlineNodes,
              walkId,
              toggle,
              config,
              !isFlexParent && hasBlockLayoutChild,
              actionContext,
            ),
          )
          consecutiveInlineNodes = []
          promises.push(
            translateWalkedElement(
              child,
              walkId,
              config,
              toggle,
              pacer,
              shouldContinue,
              actionContext,
            ),
          )
        } else {
          consecutiveInlineNodes.push(child)
        }
      }

      if (consecutiveInlineNodes.length) {
        promises.push(
          translateNodes(
            consecutiveInlineNodes,
            walkId,
            toggle,
            config,
            !isFlexParent && hasBlockLayoutChild,
            actionContext,
          ),
        )
      }
    }
  } else {
    for (const child of element.childNodes) {
      if (isHTMLElement(child)) {
        promises.push(
          translateWalkedElement(
            child,
            walkId,
            config,
            toggle,
            pacer,
            shouldContinue,
            actionContext,
          ),
        )
      }
    }
    if (element.shadowRoot) {
      for (const child of element.shadowRoot.children) {
        if (isHTMLElement(child)) {
          promises.push(
            translateWalkedElement(
              child,
              walkId,
              config,
              toggle,
              pacer,
              shouldContinue,
              actionContext,
            ),
          )
        }
      }
    }
  }
  // This simultaneously ensures that when concurrent translation
  // and external await call this function, all translations are completed
  await Promise.all(promises)
}
