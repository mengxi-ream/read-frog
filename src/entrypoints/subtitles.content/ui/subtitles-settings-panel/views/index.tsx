import type { ComponentType, ReactNode } from "react"
import { IconAdjustmentsHorizontal } from "@tabler/icons-react"
import { i18n } from "@/utils/i18n"
import { StyleView } from "./style"

export type ViewId = "main" | "style"
export const ROOT_VIEW = "main" satisfies ViewId

export interface SubpageConfig {
  id: Exclude<ViewId, "main">
  // Resolved lazily (thunk) so a runtime UI-language switch re-reads it at render
  // instead of freezing the string at module-import time.
  title: () => string
  icon: ReactNode
  component: ComponentType
  hidden?: boolean
}

export const SUBPAGES: SubpageConfig[] = [
  {
    id: "style",
    title: () => i18n.t("options.videoSubtitles.style.title"),
    icon: <IconAdjustmentsHorizontal className="size-4" />,
    component: StyleView,
  },
]

export const VISIBLE_SUBPAGES = SUBPAGES.filter(p => !p.hidden)

export const SUBPAGE_MAP = new Map(SUBPAGES.map(p => [p.id, p]))

export { MainMenu } from "./main-menu"
