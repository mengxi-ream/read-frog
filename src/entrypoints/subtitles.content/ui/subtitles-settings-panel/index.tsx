import type { SubpageId, ViewId } from "./views"
import { useAtom } from "jotai"
import { useRef } from "react"
import { subtitlesSettingsPanelOpenAtom, subtitlesSettingsPanelViewAtom } from "../../atoms"
import { PanelShell } from "./panel-shell"
import { getViewDepth, MainMenu, ROOT_VIEW, SUBPAGES } from "./views"

export function SubtitlesSettingsPanel() {
  const [isOpen, setPanelOpen] = useAtom(subtitlesSettingsPanelOpenAtom)
  const [view, setView] = useAtom(subtitlesSettingsPanelViewAtom)
  const prevViewRef = useRef<ViewId>(ROOT_VIEW)

  const subpage = view !== ROOT_VIEW ? SUBPAGES[view] : undefined

  const navigateTo = (id: SubpageId) => {
    prevViewRef.current = view
    setView(id)
  }

  const navigateBack = () => {
    prevViewRef.current = view
    setView(subpage?.parent ?? ROOT_VIEW)
  }

  const close = () => {
    setPanelOpen(false)
    setView(ROOT_VIEW)
    prevViewRef.current = ROOT_VIEW
  }

  return (
    <PanelShell
      open={isOpen}
      onClose={close}
      header={subpage ? { title: subpage.title(), onBack: navigateBack } : undefined}
      transition={
        subpage
          ? {
              key: view,
              direction:
                // oxlint-disable-next-line react/refs -- the previous view is what decides the slide direction
                getViewDepth(view) > getViewDepth(prevViewRef.current) ? "forward" : "back",
            }
          : undefined
      }
    >
      {subpage ? (
        <subpage.component onNavigate={navigateTo} />
      ) : (
        <MainMenu onNavigate={navigateTo} />
      )}
    </PanelShell>
  )
}
