import type { APICallError } from "ai"
import * as React from "react"
import textSmallCSS from "@/assets/styles/text-small.css?inline"
import themeCSS from "@/assets/styles/theme.css?inline"
import { TranslationError } from "@/components/translation/error"
import { createReactShadowHost } from "@/utils/react-shadow-host/create-shadow-host"
import { TRANSLATION_ERROR_CONTAINER_CLASS } from "../../../constants/dom-labels"
import { getOwnerDocument } from "../../dom/node"
import { translateTextForPage } from "../translate-variants"

/**
 * Create a lightweight spinner element without React/Shadow DOM overhead
 * Uses Web Animations API instead of CSS keyframes to avoid DOM injection
 * This is significantly faster than the React-based spinner for bulk operations
 */
export function createLightweightSpinner(ownerDoc: Document): HTMLElement {
  const spinner = ownerDoc.createElement("span")
  spinner.className = "read-frog-spinner"
  // Inline styles to match the original spinner design
  // add important to make the styles don't get overridden by the host page styles,
  // Otherwise, in some page like https://www.reddit.com/r/canadaexpressentry/, some spinners size will be overridden by the host page styles.
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
    border: 3px solid var(--read-frog-muted) !important;
    border-top: 3px solid var(--read-frog-primary) !important;
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
    // For reduced motion or when Web Animations API isn't available, show static spinner with muted color
    spinner.style.borderTopColor = "var(--read-frog-muted)"
  }

  return spinner
}

export function createSpinnerInside(translatedWrapperNode: HTMLElement): HTMLElement {
  const ownerDoc = getOwnerDocument(translatedWrapperNode)
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
