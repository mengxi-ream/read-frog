import type { Config } from "@/types/config/config"
import type { ThemeMode } from "@/types/config/theme"
import { QueryClientProvider } from "@tanstack/react-query"
import { Provider as JotaiProvider } from "jotai"
import { useHydrateAtoms } from "jotai/utils"
import * as React from "react"
import FrogToast from "@/components/frog-toast"
import { HelpButton } from "@/components/help-button"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
import { configAtom } from "@/utils/atoms/config"
import { baseThemeModeAtom } from "@/utils/atoms/theme"
import { getLocalConfig } from "@/utils/config/storage"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { renderPersistentReactRoot } from "@/utils/react-root"
import { queryClient } from "@/utils/tanstack-query"
import { applyTheme, getLocalThemeMode, isDarkMode } from "@/utils/theme"
import App from "./app"
import "@/assets/styles/theme.css"

interface HydrateAtomsProps {
  initialValues: [
    [typeof configAtom, Config],
    [typeof baseThemeModeAtom, ThemeMode],
  ]
  children: React.ReactNode
}

function HydrateAtoms({ initialValues, children }: HydrateAtomsProps) {
  useHydrateAtoms(initialValues)
  return children
}

async function initApp() {
  const root = document.getElementById("root")!
  root.className = "text-base antialiased min-h-screen bg-background"

  const [configValue, themeMode] = await Promise.all([
    getLocalConfig(),
    getLocalThemeMode(),
  ])
  const config = configValue ?? DEFAULT_CONFIG

  applyTheme(document.documentElement, isDarkMode(themeMode) ? "dark" : "light")

  renderPersistentReactRoot(root, (
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <JotaiProvider>
          <HydrateAtoms initialValues={[[configAtom, config], [baseThemeModeAtom, themeMode]]}>
            <ThemeProvider>
              <TooltipProvider>
                <App />
                <FrogToast />
                <HelpButton />
              </TooltipProvider>
            </ThemeProvider>
          </HydrateAtoms>
        </JotaiProvider>
      </QueryClientProvider>
    </React.StrictMode>
  ))
}

void initApp()
