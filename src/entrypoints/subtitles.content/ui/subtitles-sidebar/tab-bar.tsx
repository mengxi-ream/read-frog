import { TabsList, TabsTrigger } from "@/components/ui/base-ui/tabs"
import { SECTIONS } from "./sections"

export function SidebarTabBar() {
  return (
    // The header's border is the hairline, so it also runs under the close button.
    <TabsList variant="line" className="min-w-0 flex-1 group-data-horizontal/tabs:border-b-0">
      {SECTIONS.map((section) => (
        <TabsTrigger
          key={section.id}
          value={section.id}
          className="font-normal dark:text-foreground/60 dark:not-data-active:hover:text-foreground/80 dark:data-active:text-foreground"
        >
          {section.icon}
          {section.title()}
        </TabsTrigger>
      ))}
    </TabsList>
  )
}
