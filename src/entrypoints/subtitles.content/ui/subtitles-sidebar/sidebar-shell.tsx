import { IconX } from "@tabler/icons-react"
import { useAtom, useSetAtom } from "jotai"
import { Button } from "@/components/ui/base-ui/button"
import { ScrollArea } from "@/components/ui/base-ui/scroll-area"
import { Tabs, TabsContent } from "@/components/ui/base-ui/tabs"
import { i18n } from "@/utils/i18n"
import { subtitlesSidebarActiveSectionAtom, subtitlesSidebarOpenAtom } from "../../atoms"
import { SECTIONS } from "./sections"
import { SidebarTabBar } from "./tab-bar"

export function SidebarShell() {
  const [activeSection, setActiveSection] = useAtom(subtitlesSidebarActiveSectionAtom)
  const setOpen = useSetAtom(subtitlesSidebarOpenAtom)

  return (
    <div
      data-slot="subtitles-sidebar"
      className="pointer-events-auto flex h-full flex-col overflow-hidden rounded-[20px] border border-border bg-popover font-light text-popover-foreground shadow-floating backdrop-blur-2xl"
    >
      <Tabs value={activeSection} onValueChange={setActiveSection} className="min-h-0 flex-1 gap-0">
        <div className="flex items-center justify-end px-2 pt-2">
          <Button
            type="button"
            variant="ghost-secondary"
            size="icon-sm"
            aria-label={i18n.t("subtitles.sidebar.close")}
            onClick={() => setOpen(false)}
            className="rounded-full"
          >
            <IconX className="size-4" />
          </Button>
        </div>

        <div className="border-b border-border py-2">
          <SidebarTabBar />
        </div>

        {SECTIONS.map(({ id, component: Section }) => (
          <TabsContent key={id} value={id} className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <Section />
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
