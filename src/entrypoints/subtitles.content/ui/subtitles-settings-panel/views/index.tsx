import type { ComponentType } from "react"
import { i18n } from "@/utils/i18n"
import { DownloadView } from "./download"
import { SettingsView } from "./settings"
import { StyleView } from "./style"

export type ViewId = "main" | "download" | "settings" | "style"
export type SubpageId = Exclude<ViewId, "main">
export const ROOT_VIEW = "main" satisfies ViewId

export type NavigateToSubpage = (id: SubpageId) => void

export interface SubpageConfig {
  /** The view the header's back button returns to. */
  parent: ViewId
  // Resolved lazily (thunk) so a runtime UI-language switch re-reads it at render
  // instead of freezing the string at module-import time.
  title: () => string
  component: ComponentType<{ onNavigate: NavigateToSubpage }>
}

export const SUBPAGES: Record<SubpageId, SubpageConfig> = {
  download: {
    parent: ROOT_VIEW,
    title: () => i18n.t("subtitles.actions.download"),
    component: DownloadView,
  },
  settings: {
    parent: ROOT_VIEW,
    title: () => i18n.t("subtitles.settings"),
    component: SettingsView,
  },
  style: {
    parent: "settings",
    title: () => i18n.t("options.videoSubtitles.style.title"),
    component: StyleView,
  },
}

export function getViewDepth(id: ViewId): number {
  return id === ROOT_VIEW ? 0 : getViewDepth(SUBPAGES[id].parent) + 1
}

export { MainMenu } from "./main-menu"
