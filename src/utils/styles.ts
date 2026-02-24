export function addStyleToShadow(shadow: ShadowRoot) {
  document.head.querySelectorAll("style").forEach((styleEl) => {
    if (styleEl.textContent?.includes("[data-sonner-toaster]")) {
      const shadowHead = shadow.querySelector("head")
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

function isInternalStyleElement(node: Node) {
  if (!node)
    return false

  if (node instanceof HTMLStyleElement && node.attributes.getNamedItem("wxt-shadow-root-document-styles")) {
    return true
  }

  if (node instanceof HTMLStyleElement && node.id === "_goober") {
    return true
  }

  if (node instanceof HTMLStyleElement && node.textContent?.includes("[data-sonner-toaster]")) {
    return true
  }

  return false
}

/**
 * Mirrors dynamic style changes from document to shadow root
 * @param selector - CSS selector to find the style element (e.g., '#_goober')
 * @param shadowRoot - Target shadow root to mirror styles to
 * @param contentMatch - Optional text content to match within the style element
 */
export function mirrorDynamicStyles(selector: string, shadowRoot: ShadowRoot, contentMatch?: string): () => void {
  // TODO: 目前函数只会把找到的第一个 style 放进来，但是可能存在多个 style 匹配，那其实要全部放进来，并且对应不同的 mirrorSheet

  // Check if adoptedStyleSheets is supported
  let supportsAdoptedStyleSheets = false
  try {
    supportsAdoptedStyleSheets = "adoptedStyleSheets" in shadowRoot
      && shadowRoot.adoptedStyleSheets !== undefined
      && Array.isArray(shadowRoot.adoptedStyleSheets)
  }
  catch {
    supportsAdoptedStyleSheets = false
  }

  let mirrorSheet: CSSStyleSheet | null = null
  let mirrorStyleElement: HTMLStyleElement | null = null

  if (supportsAdoptedStyleSheets) {
    try {
      mirrorSheet = new CSSStyleSheet()
      // Use assignment instead of push for better compatibility
      shadowRoot.adoptedStyleSheets = [...shadowRoot.adoptedStyleSheets, mirrorSheet]
    }
    catch {
      // Fallback if adoptedStyleSheets fails
      supportsAdoptedStyleSheets = false
    }
  }

  if (!supportsAdoptedStyleSheets) {
    // Fallback for browsers that don't support adoptedStyleSheets
    mirrorStyleElement = document.createElement("style")
    mirrorStyleElement.setAttribute("data-mirror-styles", selector)
    shadowRoot.appendChild(mirrorStyleElement)
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

  const updateStyles = (textContent: string) => {
    if (mirrorSheet && supportsAdoptedStyleSheets) {
      mirrorSheet.replaceSync(textContent.trim())
    }
    else if (mirrorStyleElement) {
      mirrorStyleElement.textContent = textContent.trim()
    }
  }

  const srcObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      updateStyles(mutation.target.textContent ?? "")
    })
  })

  // If src is found, observe it
  if (src) {
    srcObserver.observe(src, opts)
    updateStyles(src.textContent ?? "")
  }

  // Observe the head for added style elements
  const headObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLStyleElement && node.matches(selector)) {
          // Only check content if contentMatch is provided
          if (!contentMatch || node.textContent?.includes(contentMatch)) {
            // Disconnect previous observer if src changes
            if (src && src !== node) {
              srcObserver.disconnect()
            }
            src = node
            updateStyles(node.textContent ?? "")
            srcObserver.observe(src, opts)
          }
        }
      })
    })
  })

  headObserver.observe(document.head, { childList: true })

  return () => {
    headObserver.disconnect()
    srcObserver.disconnect()

    if (mirrorSheet && supportsAdoptedStyleSheets) {
      try {
        shadowRoot.adoptedStyleSheets = shadowRoot.adoptedStyleSheets.filter(sheet => sheet !== mirrorSheet)
      }
      catch {
        // ignore cleanup failures
      }
    }

    if (mirrorStyleElement?.isConnected) {
      mirrorStyleElement.remove()
    }
  }
}

/**
 * Protects internal style elements from being removed from the document head
 * Automatically re-adds them if they get removed by other scripts
 */
export function protectInternalStyles() {
  // Track if we're currently re-adding nodes to prevent infinite loops
  let isReAddingNode = false
  // WeakSet to track nodes we've already processed to avoid duplicate operations
  const processedNodes = new WeakSet<Node>()

  const protectionObserver = new MutationObserver((mutations) => {
    // Skip processing if we're in the middle of re-adding a node
    if (isReAddingNode)
      return

    mutations.forEach((mutation) => {
      // Check removed nodes and re-add internal style elements
      mutation.removedNodes.forEach((node) => {
        if (isInternalStyleElement(node) && !processedNodes.has(node)) {
          processedNodes.add(node)
          // Use a flag to prevent recursive mutation observation
          isReAddingNode = true
          // Use requestAnimationFrame to defer the re-addition
          requestAnimationFrame(() => {
            // Check if the node is still detached before re-adding
            if (!document.contains(node)) {
              document.head.append(node)
            }
            isReAddingNode = false
            // Clean up WeakSet after a delay
            setTimeout(() => processedNodes.delete(node), 50)
          })
        }
      })
    })
  })

  protectionObserver.observe(document.head, { childList: true })

  // Return a cleanup function
  return () => protectionObserver.disconnect()
}
