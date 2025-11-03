import type { APICallError } from 'ai'
import React from 'react'
import textSmallCSS from '@/assets/tailwind/text-small.css?inline'
import themeCSS from '@/assets/tailwind/theme.css?inline'
import { TranslationError } from '@/components/translation/error'
import { createReactShadowHost } from '@/utils/react-shadow-host/create-shadow-host'
import { TRANSLATION_ERROR_CONTAINER_CLASS } from '../../../constants/dom-labels'
import { getOwnerDocument } from '../../dom/node'
import { translateText } from '../translate-text'

/**
 * Create a lightweight spinner element without React/Shadow DOM overhead
 * Uses Web Animations API instead of CSS keyframes to avoid DOM injection
 * This is significantly faster than the React-based spinner for bulk operations
 */
export function createLightweightSpinner(ownerDoc: Document): HTMLElement {
  const spinner = ownerDoc.createElement('span')
  spinner.className = 'read-frog-spinner'
  // Inline styles to match the original spinner design
  spinner.style.cssText = `
    display: inline-block;
    width: 6px;
    height: 6px;
    margin: 0 4px;
    vertical-align: middle;
    border: 3px solid var(--read-frog-muted);
    border-top: 3px solid var(--read-frog-primary);
    border-radius: 50%;
    box-sizing: content-box;
  `

  // Use Web Animations API instead of CSS keyframes - no DOM manipulation needed
  // Respect user's motion preferences
  const prefersReducedMotion = ownerDoc.defaultView?.matchMedia
    ? ownerDoc.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
  if (!prefersReducedMotion && spinner.animate) {
    spinner.animate(
      [
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(360deg)' },
      ],
      {
        duration: 600,
        iterations: Infinity,
        easing: 'linear',
      },
    )
  }
  else {
    // For reduced motion or when Web Animations API isn't available, show static spinner with muted color
    spinner.style.borderTopColor = 'var(--read-frog-muted)'
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
    translatedText = await translateText(textContent)
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
        position: 'inline',
        inheritStyles: false,
        cssContent: [themeCSS, textSmallCSS],
        style: {
          verticalAlign: 'middle',
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
