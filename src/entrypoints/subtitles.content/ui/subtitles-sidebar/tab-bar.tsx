import { TabsList, TabsTrigger } from "@/components/ui/base-ui/tabs"
import { SECTIONS } from "./sections"

export function SidebarTabBar() {
  return (
    <TabsList variant="line" className="w-full justify-start px-2">
      {SECTIONS.map((section) => (
        <TabsTrigger key={section.id} value={section.id}>
          {section.icon}
          {section.title()}
        </TabsTrigger>
      ))}
    </TabsList>
  )
}
