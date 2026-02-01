import type { ControlsConfig } from '@/entrypoints/subtitles.content/platforms'
import { useEffect, useEffectEvent, useState } from 'react'
import { getContainingShadowRoot } from '@/utils/host/dom/node'

interface ControlsInfo {
  controlsVisible: boolean
  controlsHeight: number
}

export function useControlsInfo(
  elementRef: React.RefObject<HTMLElement | null>,
  controlsConfig?: ControlsConfig,
): ControlsInfo {
  const [info, setInfo] = useState<ControlsInfo>({ controlsVisible: false, controlsHeight: 0 })

  const updateInfo = useEffectEvent((container: HTMLElement) => {
    if (!controlsConfig)
      return

    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setInfo({
      controlsVisible: controlsConfig.checkVisibility(container),
      controlsHeight: controlsConfig.measureHeight(container),
    })
  })

  useEffect(() => {
    if (!controlsConfig)
      return

    const element = elementRef.current
    if (!element)
      return

    const shadowRoot = getContainingShadowRoot(element)
    const shadowHost = shadowRoot?.host as HTMLElement | undefined
    const videoContainer = shadowHost?.parentElement
    if (!videoContainer)
      return

    updateInfo(videoContainer)

    const observer = new MutationObserver(() => {
      updateInfo(videoContainer)
    })

    observer.observe(videoContainer, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true,
    })

    return () => observer.disconnect()
  }, [controlsConfig])

  return info
}
