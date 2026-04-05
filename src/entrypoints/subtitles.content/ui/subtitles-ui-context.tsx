import type { ControlsConfig } from "@/entrypoints/subtitles.content/platforms"
import { createContext, use } from "react"

interface SubtitlesUIContextValue {
  toggleSubtitles: (enabled: boolean) => void
  controlsConfig?: ControlsConfig
}

export const SubtitlesUIContext = createContext<SubtitlesUIContextValue | null>(null)

export function useSubtitlesUI() {
  const ui = use(SubtitlesUIContext)
  if (!ui) {
    throw new Error("useSubtitlesUI must be used within SubtitlesUIContext")
  }
  return ui
}
