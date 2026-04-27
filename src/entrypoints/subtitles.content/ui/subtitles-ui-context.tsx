import type { ControlsConfig } from "@/entrypoints/subtitles.content/platforms"
import type { UniversalVideoAdapter } from "@/entrypoints/subtitles.content/universal-adapter"
import { Provider as JotaiProvider } from "jotai"
import { createContext, use } from "react"
import { subtitlesStore } from "../atoms"

interface SubtitlesUIContextValue {
  toggleSubtitles: (enabled: boolean) => void
  downloadSourceSubtitles: () => Promise<void>
  controlsConfig?: ControlsConfig
  embedded?: boolean
}

export const SubtitlesUIContext = createContext<SubtitlesUIContextValue | null>(null)

export function useSubtitlesUI() {
  const ui = use(SubtitlesUIContext)
  if (!ui) {
    throw new Error("useSubtitlesUI must be used within SubtitlesUIContext")
  }
  return ui
}

export type SubtitlesProvidersAdapter = Pick<
  UniversalVideoAdapter,
  "downloadSourceSubtitles" | "embedded" | "getControlsConfig" | "toggleSubtitlesManually"
>

export function SubtitlesProviders({
  adapter,
  children,
}: {
  adapter: SubtitlesProvidersAdapter
  children: React.ReactNode
}) {
  return (
    <JotaiProvider store={subtitlesStore}>
      <SubtitlesUIContext
        value={{
          toggleSubtitles: adapter.toggleSubtitlesManually,
          downloadSourceSubtitles: adapter.downloadSourceSubtitles,
          controlsConfig: adapter.getControlsConfig(),
          embedded: adapter.embedded,
        }}
      >
        {children}
      </SubtitlesUIContext>
    </JotaiProvider>
  )
}
