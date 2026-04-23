import type { ViewId } from "./views"
import { useAtom } from "jotai"
import { useRef } from "react"
import {
  subtitlesSettingsPanelOpenAtom,
  subtitlesSettingsPanelViewAtom,
} from "../../atoms"
import { PanelShell } from "./panel-shell"
import { MainMenu, ROOT_VIEW, SUBPAGE_MAP } from "./views"

export function SubtitlesSettingsPanel() {
  const [isOpen, setPanelOpen] = useAtom(subtitlesSettingsPanelOpenAtom)
  const [view, setView] = useAtom(subtitlesSettingsPanelViewAtom)
  const prevViewRef = useRef<ViewId>(ROOT_VIEW)

  const subpage = view !== ROOT_VIEW ? SUBPAGE_MAP.get(view) : undefined

  const navigateTo = (id: ViewId) => {
    prevViewRef.current = view
    setView(id)
  }

  const navigateBack = () => {
    prevViewRef.current = view
    setView(ROOT_VIEW)
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
      header={subpage ? { title: subpage.title, onBack: navigateBack } : undefined}
      transition={subpage
        ? {
            key: view,
            direction: prevViewRef.current === ROOT_VIEW ? "forward" : "back",
          }
        : undefined}
    >
      {subpage ? <subpage.component /> : <MainMenu onNavigate={navigateTo} />}
    </PanelShell>
  )
}
