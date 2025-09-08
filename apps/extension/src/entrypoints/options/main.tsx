import type { Config } from '@/types/config/config'
import { SidebarProvider } from '@repo/ui/components/sidebar'
import { QueryClientProvider } from '@tanstack/react-query'
import { Provider as JotaiProvider } from 'jotai'
import { useHydrateAtoms } from 'jotai/utils'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router'
import FrogToast from '@/components/frog-toast'
import { configAtom } from '@/utils/atoms/config'
import { globalConfig, loadGlobalConfig } from '@/utils/config/config'
import { DEFAULT_CONFIG } from '@/utils/constants/config'
import { isDarkMode } from '@/utils/tailwind'
import { queryClient } from '@/utils/trpc/client'
import App from './app'
import { AppSidebar } from './app-sidebar'
import '@/assets/tailwind/theme.css'
import './style.css'

document.documentElement.classList.toggle('dark', isDarkMode())
document.documentElement.style.colorScheme = isDarkMode() ? 'dark' : 'light'

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
  await loadGlobalConfig()
  const root = document.getElementById('root')!
  root.className = 'antialiased bg-background'

  const config = globalConfig ?? DEFAULT_CONFIG

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <JotaiProvider>
        <HydrateAtoms initialValues={[[configAtom, config]]}>
          <QueryClientProvider client={queryClient}>
            <HashRouter>
              <SidebarProvider>
                <AppSidebar />
                <App />
                <FrogToast />
              </SidebarProvider>
            </HashRouter>
          </QueryClientProvider>
        </HydrateAtoms>
      </JotaiProvider>
    </React.StrictMode>,
  )
}

initApp()
