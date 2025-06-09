import ReactDOM from 'react-dom/client'

import themeCSS from '../../assets/tailwind/theme.css?inline'

import { REACT_SHADOW_HOST_CLASS } from '../constants/dom-labels'
import { ShadowHostBuilder } from './shadow-host-builder'

export function createReactShadowHost(
  component: React.ReactElement,
  className?: string,
  position: 'inline' | 'block' = 'block',
  inheritStyles = false,
) {
  const container = document.createElement('div')
  if (className)
    container.className = className

  container.classList.add(REACT_SHADOW_HOST_CLASS)
  container.style.display = position

  const shadowRoot = container.attachShadow({ mode: 'open' })
  const hostBuilder = new ShadowHostBuilder(shadowRoot, {
    cssContent: themeCSS,
    inheritStyles,
  })
  const innerReactContainer = hostBuilder.build()

  const root = ReactDOM.createRoot(innerReactContainer)
  root.render(component)

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
