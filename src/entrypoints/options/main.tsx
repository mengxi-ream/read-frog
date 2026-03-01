import "@/utils/zod-config"
import type { Config } from "@/types/config/config"
import { QueryClientProvider } from "@tanstack/react-query"
import { Provider as JotaiProvider } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import * as React from "react"
import ReactDOM from "react-dom/client"
import { HashRouter } from "react-router"
import FrogToast from "@/components/frog-toast"
import { HelpButton } from "@/components/help-button"
import { ChartThemeProvider } from "@/components/providers/chart-theme-provider"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { RecoveryBoundary } from "@/components/recovery/recovery-boundary"
import { SidebarProvider } from "@/components/ui/base-ui/sidebar"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
import { configAtom } from "@/utils/atoms/config"
import { getLocalConfig } from "@/utils/config/storage"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { queryClient } from "@/utils/tanstack-query"
import App from "./app"
import { AppSidebar } from "./app-sidebar"
import "@/assets/styles/theme.css"
import "./style.css"

function HydrateAtoms({
  initialValues,
  children,
}: {
  initialValues: [[typeof configAtom, Config]]
  children: React.ReactNode
}) {
  useHydrateAtoms(initialValues)
  return children
}

async function initApp() {
  const root = document.getElementById("root")!
  root.className = "antialiased bg-background"

  const config = (await getLocalConfig()) ?? DEFAULT_CONFIG

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <JotaiProvider>
        <HydrateAtoms initialValues={[[configAtom, config]]}>
          <QueryClientProvider client={queryClient}>
            <HashRouter>
              <SidebarProvider>
                <ThemeProvider>
                  <ChartThemeProvider>
                    <TooltipProvider>
                      <FrogToast />
                      <RecoveryBoundary>
                        <AppSidebar />
                        <App />
                        <HelpButton />
                      </RecoveryBoundary>
                    </TooltipProvider>
                  </ChartThemeProvider>
                </ThemeProvider>
              </SidebarProvider>
            </HashRouter>
          </QueryClientProvider>
        </HydrateAtoms>
      </JotaiProvider>
    </React.StrictMode>,
  )
}

void initApp()
