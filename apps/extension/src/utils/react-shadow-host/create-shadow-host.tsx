import { TooltipProvider } from '@repo/ui/components/tooltip'
import { createContext } from 'react'

import ReactDOM from 'react-dom/client'
import { ThemeProvider } from '@/components/providers/theme-provider'
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

  const shadowHost = document.createElement('div')
  if (className)
    shadowHost.className = className

  shadowHost.classList.add(REACT_SHADOW_HOST_CLASS)
  shadowHost.style.display = position

  const shadowRoot = shadowHost.attachShadow({ mode: 'open' })
  const hostBuilder = new ShadowHostBuilder(shadowRoot, {
    position,
    cssContent,
    style,
    inheritStyles,
  })
  const innerReactContainer = hostBuilder.build()

  const root = ReactDOM.createRoot(innerReactContainer)
  const wrappedComponent = (
    <ShadowWrapperContext value={innerReactContainer}>
      <ThemeProvider container={innerReactContainer}>
        <TooltipProvider>
          {component}
        </TooltipProvider>
      </ThemeProvider>
    </ShadowWrapperContext>
  )

  root.render(wrappedComponent)

  ;(shadowHost as any).__reactShadowContainerCleanup = () => {
    root.unmount()
    hostBuilder.cleanup()
  }

  return shadowHost
}

export function removeReactShadowHost(shadowHost: HTMLElement) {
  if (!(shadowHost as any).__reactShadowContainerCleaned) {
    ;(shadowHost as any).__reactShadowContainerCleanup?.()
    ;(shadowHost as any).__reactShadowContainerCleaned = true
  }
  shadowHost.remove()
}
