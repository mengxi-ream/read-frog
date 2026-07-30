import { Icon } from "@iconify/react"
import { Button } from "@/components/ui/base-ui/button"
import { useSidebar } from "@/components/ui/base-ui/sidebar"

/**
 * Straddles the sidebar's right border, vertically centered.
 * The wrapper owns the centering transform so the button keeps its own press transform.
 */
export function CollapseToggle() {
  const { open, toggleSidebar } = useSidebar()

  return (
    <div className="absolute top-1/2 right-0 hidden translate-x-1/2 -translate-y-1/2 md:block">
      <Button
        variant="outline"
        size="icon-xs"
        aria-label="Toggle Sidebar"
        onClick={toggleSidebar}
        className="rounded-full bg-sidebar text-muted-foreground hover:bg-sidebar-accent hover:text-foreground dark:bg-sidebar dark:hover:bg-sidebar-accent"
      >
        <Icon icon={open ? "tabler:chevron-left" : "tabler:chevron-right"} />
      </Button>
    </div>
  )
}
