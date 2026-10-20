import type { ReactNode } from "react"
import { Icon } from "@iconify/react"
import { Link } from "react-router"
import { buttonVariants } from "@/components/ui/base-ui/button"
import { cn } from "@/utils/styles/utils"
import { useDrillInBack } from "../navigation/drill-in"
import { ConfigSection } from "./config-section"

export interface ConfigDetailSectionProps {
  /** Where the back arrow returns to — the page holding the `ConfigNavItem` that opened this. */
  backTo: string
  title: ReactNode
  /** Sits at the far end of the heading row — a docs link, and nothing that needs room to breathe. */
  action?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}

/**
 * Section header for a page drilled into from a `ConfigNavItem`: the section title with a
 * back arrow beside it, styled as any other `ConfigSection` heading.
 */
export function ConfigDetailSection({
  backTo,
  title,
  action,
  children,
  className,
  contentClassName,
}: ConfigDetailSectionProps) {
  const goBack = useDrillInBack()

  return (
    <ConfigSection
      className={className}
      contentClassName={contentClassName}
      title={
        // `justify-between` rather than an `ml-auto` on the action, so the title keeps
        // truncating against the action's edge instead of pushing it off the row.
        <span className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-1">
            <Link
              to={backTo}
              onClick={goBack}
              className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "-ml-2")}
            >
              <Icon icon="tabler:chevron-left" />
            </Link>
            {title}
          </span>
          {action}
        </span>
      }
    >
      {children}
    </ConfigSection>
  )
}
