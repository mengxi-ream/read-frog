import type { FeatureUsageContext } from "@/types/analytics"
import { useAtomValue } from "jotai"
import { useEffect, useEffectEvent } from "react"
import logo from "@/assets/icons/original/read-frog.png"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext } from "@/utils/analytics"
import { getLocalConfig } from "@/utils/config/storage"
import { TRANSLATE_BUTTON_CLASS } from "@/utils/constants/subtitles"
import { cn } from "@/utils/styles/utils"
import { subtitlesStore, subtitlesVisibleAtom } from "../atoms"

export function SubtitleToggleButton(
  { onToggle }:
  {
    onToggle: (enabled: boolean, analyticsContext?: FeatureUsageContext) => void
  },
) {
  const isVisible = useAtomValue(subtitlesVisibleAtom, { store: subtitlesStore })

  const tryStartSubtitles = useEffectEvent(async () => {
    const config = await getLocalConfig()
    const autoStart = config?.videoSubtitles?.autoStart ?? false
    if (autoStart) {
      onToggle(
        true,
        createFeatureUsageContext(
          ANALYTICS_FEATURE.VIDEO_SUBTITLES,
          ANALYTICS_SURFACE.VIDEO_SUBTITLES_AUTO,
        ),
      )
    }
  })

  useEffect(() => {
    void tryStartSubtitles()
  }, [])

  const handleClick = () => {
    const nextEnabled = !isVisible
    onToggle(
      nextEnabled,
      nextEnabled
        ? createFeatureUsageContext(
            ANALYTICS_FEATURE.VIDEO_SUBTITLES,
            ANALYTICS_SURFACE.VIDEO_SUBTITLES,
          )
        : undefined,
    )
  }

  return (
    <button
      type="button"
      aria-label="Subtitle Translation Toggle"
      onClick={handleClick}
      className={`${TRANSLATE_BUTTON_CLASS} w-12 h-full flex items-center justify-center relative bg-transparent border-none p-0 m-0 cursor-pointer`}
    >
      <img
        src={logo}
        alt="Subtitle Toggle"
        className={cn(
          "w-8 h-8 transition-opacity duration-200 object-contain block",
          isVisible ? "opacity-100" : "opacity-70",
        )}
      />
      <div
        className={cn(
          "absolute bottom-1 right-0 px-1 py-0.5 rounded text-[8px] font-medium leading-none transition-colors duration-200",
          isVisible ? "bg-green-500 text-white" : "bg-gray-500 text-white",
        )}
      >
        {isVisible ? "ON" : "OFF"}
      </div>
    </button>
  )
}
