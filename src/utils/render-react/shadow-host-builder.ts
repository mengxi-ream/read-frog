import { cssRegistry } from './css-registry'

interface ShadowHostOptions {
  cssContent?: string
  inheritStyles?: boolean
}

const resetCss = `/* Minimal Shadow DOM Reset - preserving Tailwind classes */
  :host {
    /* Isolate from parent page but don't reset all styles */
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.5;
    color: initial;
    background: initial;
    /* Allow CSS custom properties to inherit from the document */
    color-scheme: inherit;
  }
  
  /* Ensure proper box-sizing for all elements */
  *, *::before, *::after {
    box-sizing: border-box;
  }
`

/** Only care about what to put in ShadowRoot and what document CSS to register */
export class ShadowHostBuilder {
  private documentCssKey?: string

  constructor(
    private shadowRoot: ShadowRoot,
    private opts: ShadowHostOptions = {},
  ) {}

  build(): ShadowRoot {
    const { cssContent, inheritStyles } = this.opts
    const css: string[] = []

    if (!inheritStyles) {
      css.push(resetCss)
    }
    if (cssContent)
      css.push(cssContent.replaceAll(':root', ':host'))

    const { shadowCss, documentCss } = this.splitShadowRootCss(css.join('\n'))
    if (documentCss) {
      this.documentCssKey = cssRegistry.inject(documentCss)
    }
    if (shadowCss) {
      const style = document.createElement('style')
      style.textContent = shadowCss
      this.shadowRoot.appendChild(style)
    }

    return this.shadowRoot
  }

  cleanup() {
    if (this.documentCssKey)
      cssRegistry.remove(this.documentCssKey)
  }

  splitShadowRootCss(css: string): {
    documentCss: string
    shadowCss: string
  } {
    let shadowCss = css
    let documentCss = ''

    // Extract @property and @font-face rules that need to be in the document
    // Using a simpler, safer regex pattern to avoid backtracking issues
    const rulesRegex = /(@(?:property|font-face)[^{}]*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/g
    const matches = css.matchAll(rulesRegex)

    for (const match of matches) {
      documentCss += `${match[1]}\n`
      shadowCss = shadowCss.replace(match[1], '')
    }

    return {
      documentCss: documentCss.trim(),
      shadowCss: shadowCss.trim(),
    }
  }
}
