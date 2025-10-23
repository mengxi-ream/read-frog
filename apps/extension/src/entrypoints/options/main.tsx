import type { Config } from '@/types/config/config'
import { SidebarProvider } from '@repo/ui/components/sidebar'
import { QueryClientProvider } from '@tanstack/react-query'
import { Provider as JotaiProvider } from 'jotai'
import { useHydrateAtoms } from 'jotai/utils'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router'
import FrogToast from '@/components/frog-toast'
import { ChartThemeProvider } from '@/components/providers/chart-theme-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { configAtom } from '@/utils/atoms/config'
import { getConfigFromStorage } from '@/utils/config/config'
import { queryClient } from '@/utils/trpc/client'
import App from './app'
import { AppSidebar } from './app-sidebar'
import '@/assets/tailwind/theme.css'
import './style.css'

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
  const root = document.getElementById('root')!
  root.className = 'antialiased bg-background'

  const config = await getConfigFromStorage()

  if (!config) {
    throw new Error('Global config is not loaded')
  }

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <JotaiProvider>
        <HydrateAtoms initialValues={[[configAtom, config]]}>
          <QueryClientProvider client={queryClient}>
            <HashRouter>
              <SidebarProvider>
                <ThemeProvider>
                  <ChartThemeProvider>
                    <AppSidebar />
                    <App />
                    <FrogToast />
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
