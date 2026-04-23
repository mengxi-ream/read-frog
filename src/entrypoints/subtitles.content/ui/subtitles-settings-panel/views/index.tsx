import type { ComponentType, ReactNode } from "react"
import { i18n } from "#imports"
import { IconAdjustmentsHorizontal } from "@tabler/icons-react"
import { StyleView } from "./style"

export type ViewId = "main" | "style"
export const ROOT_VIEW = "main" satisfies ViewId

export interface SubpageConfig {
  id: Exclude<ViewId, "main">
  title: string
  icon: ReactNode
  component: ComponentType
  hidden?: boolean
}

export const SUBPAGES: SubpageConfig[] = [
  {
    id: "style",
    title: i18n.t("options.videoSubtitles.style.title"),
    icon: <IconAdjustmentsHorizontal className="size-4" />,
    component: StyleView,
    hidden: true,
  },
]

export const VISIBLE_SUBPAGES = SUBPAGES.filter(p => !p.hidden)

export const SUBPAGE_MAP = new Map(SUBPAGES.map(p => [p.id, p]))

export { MainMenu } from "./main-menu"
