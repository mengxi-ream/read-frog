import type React from 'react'
import ReactDOM from 'react-dom/client'

// CSS content cache to avoid repeated loading
const cssCache = new Map<string, string>()

/**
 * Load CSS content from various sources
 */
async function loadCssContent(source: string): Promise<string> {
  if (cssCache.has(source)) {
    return cssCache.get(source)!
  }

  try {
    // Try to fetch CSS as text
    const response = await fetch(source)
    if (response.ok) {
      const content = await response.text()
      cssCache.set(source, content)
      return content
    }
  }
  catch (error) {
    console.warn(`Failed to load CSS from ${source}:`, error)
  }

  return ''
}

/**
 * Load the built CSS for the current entrypoint (similar to wxt's approach)
 */
async function loadBuildCss(entrypointName?: string): Promise<string> {
  // Try to determine the entrypoint name if not provided
  const currentEntrypoint = entrypointName || 'side.content'
  const cacheKey = `build-css-${currentEntrypoint}`

  if (cssCache.has(cacheKey)) {
    return cssCache.get(cacheKey)!
  }

  try {
    // Map entrypoint names to actual CSS file names from build output
    const cssFileName = currentEntrypoint.replace('.content', '') // side.content -> side

    // Use browser.runtime.getURL to get the CSS file path like wxt does
    // @ts-expect-error: getURL is defined per-project, but type may not include all paths
    const url = browser.runtime.getURL(`content-scripts/${cssFileName}.css`)
    // console.log(`[CSS Loader] Attempting to load CSS from: ${url}`)

    const response = await fetch(url)

    if (response.ok) {
      const content = await response.text()
      // console.log(`[CSS Loader] Successfully loaded CSS, length: ${content.length}`)
      cssCache.set(cacheKey, content)
      return content
    }
    else {
      console.warn(`[CSS Loader] Failed to load CSS from ${url}: ${response.status} ${response.statusText}`)
    }
  }
  catch (error) {
    console.warn(`[CSS Loader] Error loading build CSS for ${currentEntrypoint}:`, error)
  }

  return ''
}

/**
 * Split CSS into shadow root CSS and document CSS (based on wxt approach)
 * @param css - CSS content to split
 * @returns Object with shadowCss and documentCss
 */
function splitShadowRootCss(css: string): {
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
    documentCss += match[1]
    shadowCss = shadowCss.replace(match[1], '')
  }

  return {
    documentCss: documentCss.trim(),
    shadowCss: shadowCss.trim(),
  }
}

/**
 * Inject document CSS to document head
 * @param css - CSS content to inject
 * @param instanceId - Unique instance ID for cleanup
 */
function injectDocumentCss(css: string, instanceId: string): void {
  if (!css || document.querySelector(`style[data-wxt-shadow-root-document-styles="${instanceId}"]`)) {
    return
  }

  const style = document.createElement('style')
  style.textContent = css
  style.setAttribute('data-wxt-shadow-root-document-styles', instanceId)
  document.head.appendChild(style)
}

/**
 * Remove document CSS from document head
 * @param instanceId - Instance ID to match
 */
function removeDocumentCss(instanceId: string): void {
  const documentStyle = document.querySelector(
    `style[data-wxt-shadow-root-document-styles="${instanceId}"]`,
  )
  documentStyle?.remove()
}

/**
 * Create a simple Shadow DOM structure with styles (wxt-inspired)
 * @param shadowRoot - The shadow root to populate
 * @param cssContent - CSS content to inject
 * @param inheritStyles - Whether to inherit styles from the page
 * @returns The container element for React components and instance ID for cleanup
 */
function createShadowDomStructure(
  shadowRoot: ShadowRoot,
  cssContent?: string,
  inheritStyles = false,
): { container: HTMLElement, instanceId: string } {
  const instanceId = Math.random().toString(36).substring(2, 15)
  const css: string[] = []

  // Add minimal reset styles for shadow DOM isolation
  if (!inheritStyles) {
    css.push(`
      /* Minimal Shadow DOM Reset - preserving Tailwind classes */
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
    `)
  }

  // Process and add custom CSS
  if (cssContent) {
    // console.log(`[Shadow DOM] Processing CSS content, length: ${cssContent.length}`)
    // Replace :root with :host for shadow DOM compatibility
    const processedCss = cssContent.replaceAll(':root', ':host')
    css.push(processedCss)
  }

  // Split CSS into shadow and document parts
  const { shadowCss, documentCss } = splitShadowRootCss(css.join('\n').trim())

  // Inject document CSS
  if (documentCss) {
    // console.log(`[Shadow DOM] Injecting document CSS, length: ${documentCss.length}`)
    injectDocumentCss(documentCss, instanceId)
  }

  // Add shadow CSS to shadow root
  if (shadowCss) {
    // console.log(`[Shadow DOM] Injecting shadow CSS, length: ${shadowCss.length}`)
    const styleElement = document.createElement('style')
    styleElement.textContent = shadowCss
    shadowRoot.appendChild(styleElement)
  }

  // Create a container for React components with minimal reset
  const container = document.createElement('div')
  container.style.cssText = `
    display: block;
    font-family: inherit;
    color: inherit;
  `

  shadowRoot.appendChild(container)
  return { container, instanceId }
}

/**
 * Render a React component into a DOM container
 * @param component - The React component to render
 * @param container - The DOM container to render into
 * @returns A cleanup function to unmount the component
 */
export function renderReactComponent(
  component: React.ReactElement,
  container: HTMLElement,
): () => void {
  // Create a wrapper for style isolation
  const wrapper = document.createElement('div')
  wrapper.style.cssText = `
    display: contents;
  `

  container.appendChild(wrapper)
  const root = ReactDOM.createRoot(wrapper)
  root.render(component)

  return () => {
    root.unmount()
    wrapper.remove()
  }
}

/**
 * Render a React component into a Shadow DOM with proper style isolation (wxt-inspired)
 * @param component - The React component to render
 * @param container - The DOM container that will host the shadow root
 * @param cssContent - Optional CSS content to inject
 * @param inheritStyles - Whether to inherit styles from the page
 * @returns A cleanup function to unmount the component and clean up styles
 */
export function renderReactComponentInShadow(
  component: React.ReactElement,
  container: HTMLElement,
  cssContent?: string,
  inheritStyles = false,
): () => void {
  // Create shadow root for complete style isolation
  const shadowRoot = container.attachShadow({ mode: 'open' })

  // Create proper Shadow DOM structure
  const { container: reactContainer, instanceId } = createShadowDomStructure(
    shadowRoot,
    cssContent,
    inheritStyles,
  )

  // Create React root and render
  const root = ReactDOM.createRoot(reactContainer)
  root.render(component)

  return () => {
    root.unmount()
    removeDocumentCss(instanceId)
    shadowRoot.innerHTML = '' // Clean up shadow root content
  }
}

/**
 * Create a simple wrapper for rendering a React component in a specific container (legacy)
 * @param component - The React component to render
 * @param className - Optional CSS class for the container
 * @returns Object with container element and cleanup function
 */
export function createReactComponentWrapper(
  component: React.ReactElement,
  className?: string,
): { container: HTMLElement, cleanup: () => void } {
  const container = document.createElement('span')

  if (className) {
    container.className = className
  }

  const cleanup = renderReactComponent(component, container)

  return { container, cleanup }
}

/**
 * Create a shadow DOM wrapper for rendering a React component with CSS support (wxt-inspired)
 * @param component - The React component to render
 * @param className - Optional CSS class for the container
 * @param cssPath - Optional path to CSS file (e.g., '/src/assets/tailwind/theme.css')
 * @param inheritStyles - Whether to inherit styles from the page
 * @returns Object with container element and cleanup function
 */
export async function createReactShadowWrapper(
  component: React.ReactElement,
  className?: string,
  cssPath?: string,
  inheritStyles = false,
): Promise<{ container: HTMLElement, cleanup: () => void }> {
  const container = document.createElement('span')

  if (className) {
    container.className = className
  }

  // Load CSS content if path provided
  let cssContent: string | undefined
  if (cssPath) {
    cssContent = await loadCssContent(cssPath)
  }

  const cleanup = renderReactComponentInShadow(component, container, cssContent, inheritStyles)

  return { container, cleanup }
}

/**
 * Synchronous version that accepts CSS content directly (wxt-inspired)
 */
export function createReactShadowWrapperSync(
  component: React.ReactElement,
  className?: string,
  cssContent?: string,
  inheritStyles = false,
): { container: HTMLElement, cleanup: () => void } {
  const container = document.createElement('span')

  if (className) {
    container.className = className
  }

  const cleanup = renderReactComponentInShadow(component, container, cssContent, inheritStyles)

  return { container, cleanup }
}

/**
 * Pre-defined CSS loaders for common cases
 */
export const cssLoaders = {
  // Load built CSS from the wxt build system
  buildCss: async (entrypointName?: string) => {
    const css = await loadBuildCss(entrypointName)
    return css
  },
}

/**
 * Clean up a specific React wrapper element
 * @param wrapper - The wrapper element to clean up
 */
export function cleanupReactWrapper(wrapper: HTMLElement) {
  const cleanup = (wrapper as any).__reactCleanup
  if (typeof cleanup === 'function') {
    cleanup()
  }
  wrapper.remove()
}

/**
 * Clean up all React error components in a given root
 * @param root - The root element to search for error components
 */
export function cleanupAllReactWrappers(root: Document | Element = document) {
  const errorWrappers = root.querySelectorAll('.read-frog-error-wrapper')
  errorWrappers.forEach((wrapper) => {
    if (wrapper instanceof HTMLElement) {
      cleanupReactWrapper(wrapper)
    }
  })
}
