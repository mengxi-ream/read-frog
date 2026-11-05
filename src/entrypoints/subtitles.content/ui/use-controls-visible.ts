import type { ControlsConfig } from "@/entrypoints/subtitles.content/platforms"
import { useEffect, useEffectEvent, useState } from "react"
import { MAX_CONTROLS_HEIGHT_RATIO } from "@/utils/constants/subtitles"
import { getContainingShadowRoot } from "@/utils/host/dom/node"

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
    if (!controlsConfig) return

    const maxHeight = container.getBoundingClientRect().height * MAX_CONTROLS_HEIGHT_RATIO
    const controlsVisible = controlsConfig.checkVisibility(container)
    const controlsHeight = Math.min(controlsConfig.measureHeight(container), maxHeight)
    // Most rechecks change nothing; keeping the same object spares the panel a render.
    setInfo((previous) =>
      previous.controlsVisible === controlsVisible && previous.controlsHeight === controlsHeight
        ? previous
        : { controlsVisible, controlsHeight },
    )
  })

  const setupObserver = useEffectEvent(() => {
    if (!controlsConfig) return undefined

    const element = elementRef.current
    const shadowRoot = element ? getContainingShadowRoot(element) : null
    const shadowHost = shadowRoot?.host as HTMLElement | undefined
    const videoContainer = controlsConfig.findVideoContainer?.() ?? shadowHost?.parentElement
    if (!videoContainer) return undefined

    updateInfo(videoContainer)

    const observer = new MutationObserver(() => {
      updateInfo(videoContainer)
    })
    const resizeObserver = new ResizeObserver(() => {
      updateInfo(videoContainer)
    })

    observer.observe(
      videoContainer,
      controlsConfig.observe ?? {
        attributes: true,
        attributeFilter: ["class"],
        childList: true,
        subtree: true,
      },
    )
    resizeObserver.observe(videoContainer)

    return () => {
      observer.disconnect()
      resizeObserver.disconnect()
    }
  })

  useEffect(() => {
    return setupObserver()
  }, [])

  return info
}
