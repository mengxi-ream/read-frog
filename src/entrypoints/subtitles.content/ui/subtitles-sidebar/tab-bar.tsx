import { TabsList, TabsTrigger } from "@/components/ui/base-ui/tabs"
import { SECTIONS } from "./sections"

export function SidebarTabBar() {
  return (
    <TabsList variant="line" className="min-w-0 justify-start gap-3 px-1">
      {SECTIONS.map((section) => (
        <TabsTrigger
          key={section.id}
          value={section.id}
          className="group/tab flex-none gap-0 px-1 font-normal dark:text-foreground/60 dark:not-data-active:hover:text-foreground/80 dark:data-active:text-foreground"
        >
          <span className="inline-flex w-0 items-center overflow-hidden opacity-0 transition-[width,opacity,margin] duration-200 ease-out group-data-active/tab:mr-1.5 group-data-active/tab:w-4 group-data-active/tab:opacity-100 motion-reduce:transition-none">
            {section.icon}
          </span>
          {section.title()}
        </TabsTrigger>
      ))}
    </TabsList>
  )
}
