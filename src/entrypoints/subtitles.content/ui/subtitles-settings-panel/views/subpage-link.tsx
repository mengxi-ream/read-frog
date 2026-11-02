import type { ReactNode } from "react"
import type { NavigateToSubpage, SubpageId } from "."
import { IconChevronRight } from "@tabler/icons-react"
import { SUBPAGES } from "."
import { SubpageMenuEntry } from "../components/subpage-menu-entry"

export function SubpageLink({
  id,
  icon,
  onNavigate,
}: {
  id: SubpageId
  icon?: ReactNode
  onNavigate: NavigateToSubpage
}) {
  return (
    <SubpageMenuEntry
      icon={icon}
      label={SUBPAGES[id].title()}
      onClick={() => onNavigate(id)}
      trailing={<IconChevronRight className="size-3.5" />}
    />
  )
}
