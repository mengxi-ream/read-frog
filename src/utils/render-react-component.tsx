import type React from 'react'
import ReactDOM from 'react-dom/client'

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
 * Create a simple wrapper for rendering a React component in a specific container
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
 * Clean up a specific React error wrapper element
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
