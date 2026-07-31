import type { ReactNode } from "react"
import { Icon } from "@iconify/react"
import { Link } from "react-router"
import { Button } from "@/components/ui/base-ui/button"
import { useDrillInBack } from "../navigation/drill-in"
import { ConfigSection } from "./config-section"

export interface ConfigDetailSectionProps {
  /** Where the back arrow returns to — the page holding the `ConfigNavItem` that opened this. */
  backTo: string
  title: ReactNode
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
        <span className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            className="-ml-2"
            render={<Link to={backTo} onClick={goBack} />}
          >
            <Icon icon="tabler:chevron-left" />
          </Button>
          {title}
        </span>
      }
    >
      {children}
    </ConfigSection>
  )
}
