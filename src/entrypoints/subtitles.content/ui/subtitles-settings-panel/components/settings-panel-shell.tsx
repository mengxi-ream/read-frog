import { useAtom } from "jotai"
import { Activity, useEffect, useEffectEvent, useMemo, useRef } from "react"
import { TRANSLATE_BUTTON_CONTAINER_ID } from "@/utils/constants/subtitles"
import { cn } from "@/utils/styles/utils"
import { subtitlesSettingsPanelOpenAtom } from "../../../atoms"
import { useSubtitlesUI } from "../../subtitles-ui-context"
import { useControlsInfo } from "../../use-controls-visible"

interface SettingsPanelShellProps {
  children: React.ReactNode
}

export function SettingsPanelShell({
  children,
}: SettingsPanelShellProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [isOpen, setPanelOpen] = useAtom(subtitlesSettingsPanelOpenAtom)
  const { controlsConfig } = useSubtitlesUI()
  const { controlsHeight, controlsVisible } = useControlsInfo(rootRef, controlsConfig)

  const bottomOffset = useMemo(
    () => (controlsVisible ? controlsHeight + 18 : 22),
    [controlsHeight, controlsVisible],
  )

  const onPointerDown = useEffectEvent((event: PointerEvent) => {
    if (!isOpen) {
      return
    }

    const path = event.composedPath()
    const triggerHost = document.getElementById(TRANSLATE_BUTTON_CONTAINER_ID)
    const clickedInsidePanel = !!panelRef.current && path.includes(panelRef.current)
    const clickedTrigger = !!triggerHost && path.includes(triggerHost)

    if (clickedInsidePanel || clickedTrigger) {
      return
    }

    setPanelOpen(false)
  })

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!isOpen) {
      return
    }

    if (event.key === "Escape") {
      setPanelOpen(false)
    }
  })

  useEffect(() => {
    document.addEventListener("pointerdown", onPointerDown, true)
    document.addEventListener("keydown", onKeyDown, true)

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("keydown", onKeyDown, true)
    }
  }, [])

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-40 pointer-events-none overflow-visible font-light"
    >
      <Activity mode={isOpen ? "visible" : "hidden"}>
        <div
          className={cn(
            "absolute right-4 z-40 transition-[bottom,opacity,transform] duration-200 ease-out",
            isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
          )}
          style={{ bottom: `${bottomOffset}px` }}
        >
          <div
            ref={panelRef}
            data-slot="subtitles-settings-panel"
            className="pointer-events-auto relative isolate z-40 w-[min(17rem,calc(100vw-2rem))] overflow-hidden rounded-[14px] border border-white/10 bg-[linear-gradient(180deg,rgba(24,25,29,0.82)_0%,rgba(13,14,18,0.78)_100%)] text-white shadow-[0_18px_44px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/14" />
            <div className="pointer-events-none absolute -right-12 -bottom-14 size-32 rounded-full bg-[#d8a94b]/9 blur-3xl" />
            <div>
              {children}
            </div>
          </div>
        </div>
      </Activity>
    </div>
  )
}
