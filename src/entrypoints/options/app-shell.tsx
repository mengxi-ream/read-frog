import type { ReactNode } from "react"
import { SidebarInset } from "@/components/ui/base-ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { NarrowTopBar } from "./narrow-top-bar"

/**
 * The chrome around every options route: the sidebar, the narrow-width bar that reaches back into
 * it, and the main column the pages render into. Every route shares it, so it wraps `<Routes>`
 * rather than being a layout route — but it stays out of `main.tsx`, which only wires providers.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <NarrowTopBar />
        {children}
      </SidebarInset>
    </>
  )
}
