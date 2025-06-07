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
 * Create a complete HTML document structure in shadow DOM
 * @param shadowRoot - The shadow root to populate
 * @param cssContent - CSS content to inject
 */
function createShadowHtmlStructure(shadowRoot: ShadowRoot, cssContent?: string): {
  html: HTMLHtmlElement
  head: HTMLHeadElement
  body: HTMLBodyElement
} {
  // Create complete HTML structure
  const html = document.createElement('html')
  const head = document.createElement('head')
  const body = document.createElement('body')

  // Add CSS to head if provided
  if (cssContent) {
    const styleElement = document.createElement('style')
    styleElement.textContent = cssContent
    head.appendChild(styleElement)
  }

  // Build structure
  html.appendChild(head)
  html.appendChild(body)
  shadowRoot.appendChild(html)

  return { html, head, body }
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
    all: unset;
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
 * Render a React component into a Shadow DOM with complete HTML structure
 * @param component - The React component to render
 * @param container - The DOM container that will host the shadow root
 * @param cssContent - Optional CSS content to inject
 * @returns A cleanup function to unmount the component
 */
export function renderReactComponentInShadow(
  component: React.ReactElement,
  container: HTMLElement,
  cssContent?: string,
): () => void {
  // Create shadow root for complete style isolation
  const shadowRoot = container.attachShadow({ mode: 'closed' })

  // Create complete HTML structure
  const { body } = createShadowHtmlStructure(shadowRoot, cssContent)

  // Create React wrapper inside shadow DOM body
  const reactWrapper = document.createElement('div')
  body.appendChild(reactWrapper)

  // Create React root and render
  const root = ReactDOM.createRoot(reactWrapper)
  root.render(component)

  return () => {
    root.unmount()
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
 * Create a shadow DOM wrapper for rendering a React component with CSS support
 * @param component - The React component to render
 * @param className - Optional CSS class for the container
 * @param cssPath - Optional path to CSS file (e.g., '/src/assets/tailwind/theme.css')
 * @returns Object with container element and cleanup function
 */
export async function createReactShadowWrapper(
  component: React.ReactElement,
  className?: string,
  cssPath?: string,
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

  const cleanup = renderReactComponentInShadow(component, container, cssContent)

  return { container, cleanup }
}

/**
 * Synchronous version that accepts CSS content directly
 */
export function createReactShadowWrapperSync(
  component: React.ReactElement,
  className?: string,
  cssContent?: string,
): { container: HTMLElement, cleanup: () => void } {
  const container = document.createElement('span')

  if (className) {
    container.className = className
  }

  const cleanup = renderReactComponentInShadow(component, container, cssContent)

  return { container, cleanup }
}

/**
 * Pre-defined CSS loaders for common cases
 */
export const cssLoaders = {
  // Load inline theme CSS content
  themeInline: () => `
    @import 'tailwindcss';
    @import 'tw-animate-css';
    
    @custom-variant dark (&:is(.dark *));
    
    @theme inline {
      --color-background: var(--background);
      --color-foreground: var(--foreground);
      --color-sidebar-ring: var(--sidebar-ring);
      --color-sidebar-border: var(--sidebar-border);
      --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
      --color-sidebar-accent: var(--sidebar-accent);
      --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
      --color-sidebar-primary: var(--sidebar-primary);
      --color-sidebar-foreground: var(--sidebar-foreground);
      --color-sidebar: var(--sidebar);
      --color-chart-5: var(--chart-5);
      --color-chart-4: var(--chart-4);
      --color-chart-3: var(--chart-3);
      --color-chart-2: var(--chart-2);
      --color-chart-1: var(--chart-1);
      --color-ring: var(--ring);
      --color-input: var(--input);
      --color-border: var(--border);
      --color-warning: var(--warning);
      --color-warning-border: var(--warning-border);
      --color-destructive: var(--destructive);
      --color-accent-foreground: var(--accent-foreground);
      --color-accent: var(--accent);
      --color-muted-foreground: var(--muted-foreground);
      --color-muted: var(--muted);
      --color-secondary-foreground: var(--secondary-foreground);
      --color-secondary: var(--secondary);
      --color-primary-foreground: var(--primary-foreground);
      --color-primary: var(--primary);
      --color-popover-foreground: var(--popover-foreground);
      --color-popover: var(--popover);
      --color-card-foreground: var(--card-foreground);
      --color-card: var(--card);
      --radius-sm: calc(var(--radius) - 4px);
      --radius-md: calc(var(--radius) - 2px);
      --radius-lg: var(--radius);
      --radius-xl: calc(var(--radius) + 4px);
    }
    
    :root {
      --radius: 0.625rem;
      --background: oklch(1 0 0);
      --foreground: oklch(0.145 0 0);
      --card: oklch(1 0 0);
      --card-foreground: oklch(0.145 0 0);
      --popover: oklch(1 0 0);
      --popover-foreground: oklch(0.145 0 0);
      --primary: oklch(69.6% 0.17 162.48);
      --primary-foreground: oklch(0.985 0 0);
      --secondary: oklch(0.97 0 0);
      --secondary-foreground: oklch(0.205 0 0);
      --muted: oklch(0.97 0 0);
      --muted-foreground: oklch(0.556 0 0);
      --accent: oklch(0.97 0 0);
      --accent-foreground: oklch(0.205 0 0);
      --warning: oklch(97.3% 0.071 103.193);
      --warning-border: oklch(85.2% 0.199 91.936);
      --destructive: oklch(0.577 0.245 27.325);
      --border: oklch(0.922 0 0);
      --input: oklch(0.922 0 0);
      --ring: oklch(0.708 0 0);
      --chart-1: oklch(0.646 0.222 41.116);
      --chart-2: oklch(0.6 0.118 184.704);
      --chart-3: oklch(0.398 0.07 227.392);
      --chart-4: oklch(0.828 0.189 84.429);
      --chart-5: oklch(0.769 0.188 70.08);
      --sidebar: oklch(0.985 0 0);
      --sidebar-foreground: oklch(0.145 0 0);
      --sidebar-primary: oklch(0.205 0 0);
      --sidebar-primary-foreground: oklch(0.985 0 0);
      --sidebar-accent: oklch(0.97 0 0);
      --sidebar-accent-foreground: oklch(0.205 0 0);
      --sidebar-border: oklch(0.922 0 0);
      --sidebar-ring: oklch(0.708 0 0);
    }
    
    .dark {
      --background: oklch(0.145 0 0);
      --foreground: oklch(0.985 0 0);
      --card: oklch(0.205 0 0);
      --card-foreground: oklch(0.985 0 0);
      --popover: oklch(0.205 0 0);
      --popover-foreground: oklch(0.985 0 0);
      --primary: oklch(69.6% 0.17 162.48);
      --primary-foreground: oklch(0.205 0 0);
      --secondary: oklch(0.269 0 0);
      --secondary-foreground: oklch(0.985 0 0);
      --muted: oklch(0.269 0 0);
      --muted-foreground: oklch(0.708 0 0);
      --accent: oklch(0.269 0 0);
      --accent-foreground: oklch(0.985 0 0);
      --warning: oklch(42.1% 0.095 57.708);
      --warning-border: oklch(68.1% 0.162 75.834);
      --destructive: oklch(0.704 0.191 22.216);
      --border: oklch(1 0 0 / 10%);
      --input: oklch(1 0 0 / 15%);
      --ring: oklch(0.556 0 0);
      --chart-1: oklch(0.488 0.243 264.376);
      --chart-2: oklch(0.696 0.17 162.48);
      --chart-3: oklch(0.769 0.188 70.08);
      --chart-4: oklch(0.627 0.265 303.9);
      --chart-5: oklch(0.645 0.246 16.439);
      --sidebar: oklch(0.205 0 0);
      --sidebar-foreground: oklch(0.985 0 0);
      --sidebar-primary: oklch(0.488 0.243 264.376);
      --sidebar-primary-foreground: oklch(0.985 0 0);
      --sidebar-accent: oklch(0.269 0 0);
      --sidebar-accent-foreground: oklch(0.985 0 0);
      --sidebar-border: oklch(1 0 0 / 10%);
      --sidebar-ring: oklch(0.556 0 0);
    }
    
    @layer base {
      * {
        border-color: var(--border);
        outline-color: rgb(var(--ring) / 50%);
      }
      body {
        background-color: var(--background);
        color: var(--foreground);
      }
    }
  `,
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
