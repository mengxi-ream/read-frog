export function addStyleToShadow(shadow: ShadowRoot) {
  document.head.querySelectorAll('style').forEach((styleEl) => {
    if (styleEl.textContent?.includes('[data-sonner-toaster]')) {
      const shadowHead = shadow.querySelector('head')
      // Clone the style element instead of moving it to preserve the original
      // Otherwise, append api will move the style element to the shadow root and cause the bug
      const clonedStyle = styleEl.cloneNode(true)
      if (shadowHead) {
        shadowHead.append(clonedStyle)
      }
      else {
        shadow.append(clonedStyle)
      }
    }
  })
}

export function mirrorDynamicStyles(selector: string, shadowRoot: ShadowRoot, contentMatch?: string) {
  // TODO: 目前函数只会把找到的第一个 style 放进来，但是可能存在多个 style 匹配，那其实要全部放进来，并且对应不同的 mirrorSheet
  // Check adoptedStyleSheets compatibility
  const supportsAdoptedStyleSheets = 'adoptedStyleSheets' in shadowRoot
    && Array.isArray(shadowRoot.adoptedStyleSheets)
    && typeof shadowRoot.adoptedStyleSheets.push === 'function'

  let mirrorSheet: CSSStyleSheet | null = null
  let mirrorStyleElement: HTMLStyleElement | null = null

  if (supportsAdoptedStyleSheets) {
    // Modern browsers: use adoptedStyleSheets
    mirrorSheet = new CSSStyleSheet()
    shadowRoot.adoptedStyleSheets = [...shadowRoot.adoptedStyleSheets, mirrorSheet]
  }
  else {
    // Compatibility mode: use <style> element
    // Check for existing mirror style element to prevent duplicates
    const existingMirror = shadowRoot.querySelector('style[data-mirror-styles]')
    if (existingMirror) {
      mirrorStyleElement = existingMirror as HTMLStyleElement
    }
    else {
      mirrorStyleElement = document.createElement('style')
      mirrorStyleElement.setAttribute('data-mirror-styles', 'true')
      shadowRoot.appendChild(mirrorStyleElement)
    }
  }

  // Find all elements matching selector, then filter by content if contentMatch is provided
  const findMatchingElement = () => {
    const elements = Array.from(document.querySelectorAll(selector))
    if (contentMatch) {
      return elements.find(
        el =>
          el instanceof HTMLStyleElement
          && el.textContent?.includes(contentMatch),
      )
    }
    // If no contentMatch is provided, return the first matching element
    return elements.find(el => el instanceof HTMLStyleElement)
  }

  let src = findMatchingElement()

  const opts = {
    characterData: true,
    childList: true,
    subtree: true,
    attributes: true,
  }

  const srcObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mirrorSheet) {
        mirrorSheet.replaceSync(mutation.target.textContent?.trim() ?? '')
      }
    })
  })

  // If src is found, observe it
  if (src) {
    srcObserver.observe(src, opts)
    if (mirrorSheet) {
      mirrorSheet.replaceSync(src.textContent?.trim() ?? '')
    }
  }

  // Observe the head for added style elements
  const headObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLStyleElement && node.matches(selector)) {
          // Only check content if contentMatch is provided
          if (!contentMatch || node.textContent?.includes(contentMatch)) {
            src = node
            if (mirrorSheet) {
              mirrorSheet.replaceSync(node.textContent?.trim() ?? '')
            }
            srcObserver.observe(src, opts)
          }
        }
      })
      // TODO: handle removed nodes
    })
  })

  headObserver.observe(document.head, { childList: true })
}
