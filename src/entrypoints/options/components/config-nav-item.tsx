import type { ReactNode } from "react"
import { Icon } from "@iconify/react"
import { Link } from "react-router"
import { cn } from "@/utils/styles/utils"
import { DRILL_IN_LOCATION_STATE } from "../navigation/drill-in"
import { ConfigItem } from "./config-item"

export interface ConfigNavItemProps {
  to: string
  title: ReactNode
  description: ReactNode
  className?: string
}

/**
 * A `ConfigItem` that drills into a detail page instead of holding a control. The negative
 * inline margin lets the hover background bleed past the surrounding rows while the text
 * stays aligned with them.
 */
export function ConfigNavItem({ to, title, description, className }: ConfigNavItemProps) {
  return (
    <Link
      to={to}
      state={DRILL_IN_LOCATION_STATE}
      className={cn(
        "-mx-3 block rounded-lg px-3 py-2 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <ConfigItem title={title} description={description}>
        <Icon icon="tabler:chevron-right" className="size-4 text-muted-foreground" />
      </ConfigItem>
    </Link>
  )
}
