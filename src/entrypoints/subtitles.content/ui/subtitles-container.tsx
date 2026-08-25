import { useAtomValue } from "jotai"
import { use } from "react"
import { AnchoredToastProvider } from "@/components/ui/base-ui/toast"
import { ShadowWrapperContext } from "@/utils/react-shadow-host/create-shadow-host"
import { subtitlesDisplayAtom, subtitlesShowContentAtom, subtitlesShowStateAtom } from "../atoms"
import { StateMessage } from "./state-message"
import { SubtitlesSettingsPanel } from "./subtitles-settings-panel"
import { SubtitlesUIContext } from "./subtitles-ui-context"
import { SubtitlesView } from "./subtitles-view"
import { useSubtitlesCustomCSS } from "./use-subtitles-custom-css"

export function SubtitlesContainer() {
  const { stateData, isVisible } = useAtomValue(subtitlesDisplayAtom)
  const showState = useAtomValue(subtitlesShowStateAtom)
  const showContent = useAtomValue(subtitlesShowContentAtom)
  const ui = use(SubtitlesUIContext)
  // Portals into this host rather than the docked toast host, which hangs off
  // document.body: this one lives inside the player, so an anchored toast can
  // reach its trigger and survives the player going fullscreen.
  const shadowWrapper = use(ShadowWrapperContext)

  useSubtitlesCustomCSS()

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      <div className="absolute inset-0 z-10 overflow-visible">
        {isVisible && (
          <>
            <SubtitlesView showContent={showContent} />
            <StateMessage state={showState} message={stateData?.message} />
          </>
        )}
      </div>

      {(!ui?.embedded || ui?.openBelow) && (
        <div className="absolute inset-0 z-40 overflow-visible">
          <SubtitlesSettingsPanel />
        </div>
      )}

      <AnchoredToastProvider portalProps={{ container: shadowWrapper }} />
    </div>
  )
}
