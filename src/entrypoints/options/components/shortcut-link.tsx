import { Icon } from "@iconify/react"
import { Link } from "react-router"
import { buttonVariants } from "@/components/ui/base-ui/button"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"
import { buildSectionLink } from "../command-palette/section-scroll"

/**
 * Points a setting at the row on the Shortcuts page that records its keys. Every shortcut is
 * edited in one place; the feature it belongs to only says that it has one and how to get there.
 *
 * Render inside a `ConfigItem` description, under the sentence it belongs to — the negative
 * margin pulls the ghost padding back so the label starts on the description's own edge.
 */
export function ShortcutLink({ sectionId, className }: { sectionId: string; className?: string }) {
  return (
    <span className={cn("mt-2 flex", className)}>
      <Link
        to={buildSectionLink("/shortcuts", sectionId)}
        className={cn(
          buttonVariants({ variant: "ghost", size: "xs" }),
          "-ml-2.5 text-muted-foreground",
        )}
      >
        <Icon icon="tabler:command" />
        {i18n.t("options.shortcuts.setShortcut")}
      </Link>
    </span>
  )
}
