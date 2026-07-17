import type { APICallError } from "ai"
import type { TranslationTextFormat } from "@/types/config/translate"
import * as React from "react"
import textSmallCSS from "@/assets/styles/text-small.css?inline"
import themeCSS from "@/assets/styles/theme.css?inline"
import { TranslationError } from "@/components/translation/error"
import { createReactShadowHost } from "@/utils/react-shadow-host/create-shadow-host"
import { isTranslationCancelledError } from "@/utils/request/cancellation"
import { SPINNER_CLASS, TRANSLATION_ERROR_CONTAINER_CLASS } from "../../../constants/dom-labels"
import { getContainingShadowRoot, getOwnerDocument } from "../../dom/node"
import { translateTextForPage } from "../translate-variants"
import { ensurePresetStyles } from "./style-injector"

/**
 * Concurrent spin-animation ceiling. Thousands of live WAAPI animations tick
 * a full-page style recalc every frame and saturate the main thread on long
 * pages (#1881: 2400+ concurrent spinners measured). Beyond the cap, pending
 * paragraphs get the static muted ring instead.
 */
export const MAX_ANIMATED_SPINNERS = 60

/**
 * Animation created for each spinner, kept so teardown can cancel it directly.
 * Element.getAnimations() gets expensive when the document holds thousands of
 * live animations (10% of CPU samples in the #1881 trace); the stored handle
 * makes cancellation O(1).
 */
const spinnerAnimations = new WeakMap<HTMLElement, Animation>()
let activeSpinnerAnimationCount = 0

/**
 * Cancel the spinner's spin animation. A running animation roots its detached
 * target in the renderer, leaking one node per translated paragraph (#1831),
 * so every teardown path must call this before dropping the spinner.
 */
export function cancelSpinnerAnimation(spinner: HTMLElement): void {
  const animation = spinnerAnimations.get(spinner)
  if (animation) {
    spinnerAnimations.delete(spinner)
    activeSpinnerAnimationCount = Math.max(0, activeSpinnerAnimationCount - 1)
    animation.cancel()
    return
  }
  // Fallback for spinners created before this registry existed (or if the
  // WeakMap entry was lost). jsdom lacks getAnimations, hence the `?.`.
  spinner.getAnimations?.().forEach((liveAnimation) => liveAnimation.cancel())
}

/**
 * Create a lightweight spinner element without React/Shadow DOM overhead
 * Uses Web Animations API instead of CSS keyframes to avoid DOM injection
 * This is significantly faster than the React-based spinner for bulk operations
 */
export function createLightweightSpinner(ownerDoc: Document): HTMLElement {
  const spinner = ownerDoc.createElement("span")
  spinner.className = SPINNER_CLASS
  // Inline styles keep the spinner resilient against host page CSS overrides.
  // Use a thin muted arc with transparent sides so bulk page translation does
  // not paint a dense field of high-contrast rings across the screen.
  spinner.style.cssText = `
    display: inline-block !important;
    width: 6px !important;
    height: 6px !important;
    min-width: 6px !important;
    min-height: 6px !important;
    max-width: 6px !important;
    max-height: 6px !important;
    aspect-ratio: 1 / 1 !important;
    margin: 0 4px !important;
    padding: 0 !important;
    vertical-align: middle !important;
    border: 1.5px solid transparent !important;
    border-top: 1.5px solid var(--read-frog-muted-foreground) !important;
    border-radius: 50% !important;
    box-sizing: content-box !important;
    flex-shrink: 0 !important;
    flex-grow: 0 !important;
    align-self: center !important;
  `

  // Use Web Animations API instead of CSS keyframes - no DOM manipulation needed
  // Respect user's motion preferences
  const prefersReducedMotion = ownerDoc.defaultView?.matchMedia
    ? ownerDoc.defaultView.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false
  if (
    !prefersReducedMotion &&
    spinner.animate &&
    activeSpinnerAnimationCount < MAX_ANIMATED_SPINNERS
  ) {
    const animation = spinner.animate(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
      {
        duration: 600,
        iterations: Infinity,
        easing: "linear",
      },
    )
    spinnerAnimations.set(spinner, animation)
    activeSpinnerAnimationCount++
  } else {
    // For reduced motion or when Web Animations API isn't available,
    // keep a static muted segment so the loading state stays visible
    // without requiring animation.
    spinner.style.borderTopColor = "var(--read-frog-muted-foreground)"
  }

  return spinner
}

export function createSpinnerInside(translatedWrapperNode: HTMLElement): HTMLElement {
  const ownerDoc = getOwnerDocument(translatedWrapperNode)
  const root = getContainingShadowRoot(translatedWrapperNode) ?? ownerDoc
  ensurePresetStyles(root)
  const spinner = createLightweightSpinner(ownerDoc)
  translatedWrapperNode.appendChild(spinner)
  return spinner
}

export async function getTranslatedTextAndRemoveSpinner(
  nodes: ChildNode[],
  textContent: string,
  spinner: HTMLElement,
  translatedWrapperNode: HTMLElement,
  isCurrent: () => boolean = () => true,
  textFormat: TranslationTextFormat = "plain",
  translateRequest: () => Promise<string> = () => translateTextForPage(textContent, textFormat),
): Promise<string | undefined> {
  let translatedText: string | undefined

  try {
    if (!isCurrent()) return undefined
    translatedText = await translateRequest()
    if (!isCurrent()) return undefined
  } catch (error) {
    // User-cancelled sessions must fail silently: the wrapper is already
    // detached by stop(), and translationOnly mode passes isCurrent=()=>true,
    // so rendering an error here would mount a React root on a detached
    // wrapper (the #1831 leak class).
    if (isTranslationCancelledError(error)) return undefined
    if (!isCurrent()) return undefined

    const errorComponent = React.createElement(TranslationError, {
      nodes,
      error: error as APICallError,
    })

    const container = createReactShadowHost(errorComponent, {
      className: TRANSLATION_ERROR_CONTAINER_CLASS,
      position: "inline",
      inheritStyles: false,
      cssContent: [themeCSS, textSmallCSS],
      style: {
        verticalAlign: "middle",
      },
    })

    translatedWrapperNode.appendChild(container)
  } finally {
    cancelSpinnerAnimation(spinner)
    spinner.remove()
  }

  return translatedText
}
