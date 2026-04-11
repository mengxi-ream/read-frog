import type { APICallError } from "ai"
import * as React from "react"
import textSmallCSS from "@/assets/styles/text-small.css?inline"
import themeCSS from "@/assets/styles/theme.css?inline"
import { TranslationError } from "@/components/translation/error"
import { createReactShadowHost } from "@/utils/react-shadow-host/create-shadow-host"
import { TRANSLATION_ERROR_CONTAINER_CLASS } from "../../../constants/dom-labels"
import { getContainingShadowRoot, getOwnerDocument } from "../../dom/node"
import { translateTextForPage } from "../translate-variants"
import { ensurePresetStyles } from "./style-injector"

/**
 * Create a lightweight spinner element without React/Shadow DOM overhead
 * Uses Web Animations API instead of CSS keyframes to avoid DOM injection
 * This is significantly faster than the React-based spinner for bulk operations
 */
export function createLightweightSpinner(ownerDoc: Document): HTMLElement {
  const spinner = ownerDoc.createElement("span")
  spinner.className = "read-frog-spinner"
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
  if (!prefersReducedMotion && spinner.animate) {
    spinner.animate(
      [
        { transform: "rotate(0deg)" },
        { transform: "rotate(360deg)" },
      ],
      {
        duration: 600,
        iterations: Infinity,
        easing: "linear",
      },
    )
  }
  else {
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
): Promise<string | undefined> {
  let translatedText: string | undefined

  try {
    translatedText = await translateTextForPage(textContent)
  }
  catch (error) {
    const errorComponent = React.createElement(TranslationError, {
      nodes,
      error: error as APICallError,
    })

    const container = createReactShadowHost(
      errorComponent,
      {
        className: TRANSLATION_ERROR_CONTAINER_CLASS,
        position: "inline",
        inheritStyles: false,
        cssContent: [themeCSS, textSmallCSS],
        style: {
          verticalAlign: "middle",
        },
      },
    )

    translatedWrapperNode.appendChild(container)
  }
  finally {
    spinner.remove()
  }

  return translatedText
}
