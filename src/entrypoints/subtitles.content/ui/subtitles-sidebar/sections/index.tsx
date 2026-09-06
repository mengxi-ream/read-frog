import type { ComponentType, ReactNode } from "react"
import { IconFileTextAi } from "@tabler/icons-react"
import { i18n } from "@/utils/i18n"
import { SummarySection } from "./summary"

export type SectionId = "summary"

export interface SectionConfig {
  id: SectionId
  // Resolved lazily (thunk) so a runtime UI-language switch re-reads it at render
  // instead of freezing the string at module-import time.
  title: () => string
  icon: ReactNode
  component: ComponentType
}

export const SECTIONS: SectionConfig[] = [
  {
    id: "summary",
    title: () => i18n.t("subtitles.sidebar.menu.label"),
    icon: <IconFileTextAi className="size-4" />,
    component: SummarySection,
  },
]

export const DEFAULT_SECTION_ID: SectionId = SECTIONS[0]!.id
