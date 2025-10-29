'use client'

import { cn } from '@repo/ui/lib/utils'
import { useEffect, useRef } from 'react'

interface CSSStylePreviewProps {
  cssCode: string
  className?: string
}

/**
 * CSS Style Preview Component for Blog Posts
 *
 * Displays a live preview of custom CSS styles applied to translated text.
 * Uses Shadow DOM for style isolation to prevent CSS conflicts.
 *
 * Usage in MDX:
 * ```css
 * [data-read-frog-custom-translation-style='custom'] {
 *   background-color: yellow;
 * }
 * ```
 *
 * <CSSStylePreview cssCode={`[data-read-frog-custom-translation-style='custom'] {
 *   background-color: yellow;
 * }`} />
 */
export function CSSStylePreview({
  cssCode,
  className,
}: CSSStylePreviewProps) {
  const shadowHostRef = useRef<HTMLDivElement>(null)

  const originText = `Mr. Kamiya isn't confronting the world; he's confronting something that might make the world turn its head.`
  const translatedText = '神谷先生不是在对抗世界,而是在对抗可能让世界为之侧目的事物。'

  useEffect(() => {
    if (!shadowHostRef.current)
      return

    // Create shadow root if it doesn't exist
    let shadowRoot = shadowHostRef.current.shadowRoot
    if (!shadowRoot) {
      shadowRoot = shadowHostRef.current.attachShadow({ mode: 'open' })
    }

    // Clear previous content
    shadowRoot.innerHTML = ''

    // Create style element for custom CSS
    const styleElement = document.createElement('style')
    styleElement.textContent = cssCode

    // Create base styles for the preview container
    const baseStyleElement = document.createElement('style')
    baseStyleElement.textContent = `
      :host {
        display: block;
        width: 100%;
      }
      .preview-container {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 1.5rem;
        border: 1px solid hsl(var(--border));
        border-radius: 0.5rem;
        background-color: hsl(var(--card));
      }
      .text {
        font-size: 0.875rem;
        line-height: 1.5;
        color: hsl(var(--foreground));
        word-break: break-word;
        margin: 0;
      }
      p {
        margin-block-end: 0;
        margin-block-start: 0;
      }
      .original {
        opacity: 0.7;
      }
    `

    // Create container
    const container = document.createElement('div')
    container.className = 'preview-container'

    // Create original text
    const originalPara = document.createElement('p')
    originalPara.className = 'text original'
    originalPara.textContent = originText

    // Create translated text with custom style attribute
    const translatedPara = document.createElement('p')
    translatedPara.className = 'text'
    translatedPara.setAttribute('data-read-frog-custom-translation-style', 'custom')
    translatedPara.textContent = translatedText

    // Assemble shadow DOM
    container.appendChild(originalPara)
    container.appendChild(translatedPara)
    shadowRoot.appendChild(baseStyleElement)
    shadowRoot.appendChild(styleElement)
    shadowRoot.appendChild(container)
  }, [cssCode, originText, translatedText])

  return (
    <div className={cn('not-prose my-4 border rounded-lg overflow-hidden', className)}>
      {/* Shadow DOM preview */}
      <div ref={shadowHostRef} className="w-full" />
    </div>
  )
}
