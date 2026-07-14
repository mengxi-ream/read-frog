import type { ControlsConfig } from "@/entrypoints/subtitles.content/platforms"
import type { SubtitlesProvidersAdapter } from "@/entrypoints/subtitles.content/universal-adapter"
import { Provider as JotaiProvider } from "jotai"
import { createContext, use, useMemo } from "react"
import { subtitlesStore } from "../atoms"

interface SubtitlesUIContextValue {
  toggleSubtitles: (enabled: boolean) => void
  requestAiSubtitles: () => Promise<void>
  supportsAiSubtitles: boolean
  downloadSourceSubtitles: () => Promise<void>
  downloadTranslatedSubtitles: () => Promise<void>
  controlsConfig?: ControlsConfig
  embedded?: boolean
  openBelow?: boolean
  containerShrinkRatio?: (container: HTMLElement) => number | null
}

export const SubtitlesUIContext = createContext<SubtitlesUIContextValue | null>(null)

export function useSubtitlesUI() {
  const ui = use(SubtitlesUIContext)
  if (!ui) {
    throw new Error("useSubtitlesUI must be used within SubtitlesUIContext")
  }
  return ui
}

export function SubtitlesProviders({
  adapter,
  children,
  openBelow,
}: {
  adapter: SubtitlesProvidersAdapter
  children: React.ReactNode
  openBelow?: boolean
}) {
  const contextValue = useMemo(
    () => ({
      toggleSubtitles: adapter.toggleSubtitlesManually,
      requestAiSubtitles: adapter.requestAiSubtitles,
      supportsAiSubtitles: adapter.supportsAiSubtitles,
      downloadSourceSubtitles: adapter.downloadSourceSubtitles,
      downloadTranslatedSubtitles: adapter.downloadTranslatedSubtitles,
      controlsConfig: adapter.getControlsConfig(),
      embedded: adapter.embedded,
      openBelow,
      containerShrinkRatio: adapter.containerShrinkRatio,
    }),
    [adapter, openBelow],
  )

  return (
    <JotaiProvider store={subtitlesStore}>
      <SubtitlesUIContext value={contextValue}>{children}</SubtitlesUIContext>
    </JotaiProvider>
  )
}
