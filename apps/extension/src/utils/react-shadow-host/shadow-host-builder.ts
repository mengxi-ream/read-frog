import { isDarkMode } from '../theme'
import { cssRegistry } from './css-registry'

interface ShadowHostOptions {
  position: 'inline' | 'block'
  cssContent?: string[]
  style?: Partial<CSSStyleDeclaration>
  inheritStyles?: boolean
}

const resetCss = `/* WXT-inspired Shadow DOM Reset */
  :host {
    /* Essential style isolation */
    all: initial;
    /* Override all: initial for essential inherited properties we want to keep */
    color-scheme: inherit;
    /* Restore modern font stack */
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
    private opts: ShadowHostOptions = {
      position: 'block',
    },
  ) {}

  build(): HTMLElement {
    const { cssContent, inheritStyles, position, style } = this.opts
    const css: string[] = []

    if (!inheritStyles) {
      css.push(resetCss)
    }
    if (cssContent)
      css.push(...cssContent.map(css => css.replaceAll(':root', ':host')))

    const { shadowCss, documentCss } = this.splitShadowRootCss(css.join('\n'))
    if (documentCss) {
      this.documentCssKey = cssRegistry.inject(documentCss)
    }
    if (shadowCss) {
      const style = document.createElement('style')
      style.textContent = shadowCss
      this.shadowRoot.appendChild(style)
    }

    // add wrapper
    const wrapper = document.createElement('div')
    wrapper.style.display = position
    if (style) {
      Object.assign(wrapper.style, style)
    }
    if (isDarkMode()) {
      wrapper.classList.add('dark')
      wrapper.style.colorScheme = 'dark'
    }
    this.shadowRoot.appendChild(wrapper)

    return wrapper
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
