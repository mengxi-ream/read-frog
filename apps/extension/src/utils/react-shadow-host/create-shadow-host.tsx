import { createContext } from 'react'
import ReactDOM from 'react-dom/client'

import { TooltipProvider } from '@/components/ui/tooltip'
import { REACT_SHADOW_HOST_CLASS } from '../constants/dom-labels'
import { ShadowHostBuilder } from './shadow-host-builder'

export const ShadowWrapperContext = createContext<HTMLElement | null>(null)

export function createReactShadowHost(
  component: React.ReactElement,
  options: {
    position: 'inline' | 'block'
    inheritStyles: boolean
    className?: string
    cssContent?: string[]
    style?: Partial<CSSStyleDeclaration>
  },
) {
  const { className, position, inheritStyles, cssContent, style } = options

  const container = document.createElement('div')
  if (className)
    container.className = className

  container.classList.add(REACT_SHADOW_HOST_CLASS)
  container.style.display = position

  if (style) {
    Object.assign(container.style, style)
  }

  const shadowRoot = container.attachShadow({ mode: 'open' })
  const hostBuilder = new ShadowHostBuilder(shadowRoot, {
    position,
    cssContent,
    inheritStyles,
  })
  const innerReactContainer = hostBuilder.build()

  const root = ReactDOM.createRoot(innerReactContainer)
  const wrappedComponent = (
    <ShadowWrapperContext value={innerReactContainer}>
      <TooltipProvider>
        {component}
      </TooltipProvider>
    </ShadowWrapperContext>
  )

  root.render(wrappedComponent)

  ;(container as any).__reactShadowContainerCleanup = () => {
    root.unmount()
    hostBuilder.cleanup()
  }

  return container
}

export function removeReactShadowHost(shadowHost: HTMLElement) {
  ;(shadowHost as any).__reactShadowContainerCleanup?.()
  shadowHost.remove()
}
