import type { Config } from '@/types/config/config'
import { QueryClientProvider } from '@tanstack/react-query'
import { Agentation } from 'agentation'
import { Provider as JotaiProvider } from 'jotai'
import { useHydrateAtoms } from 'jotai/utils'
import React from 'react'
import ReactDOM from 'react-dom/client'
import FrogToast from '@/components/frog-toast'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { TooltipProvider } from '@/components/shadcn/tooltip'
import { configAtom } from '@/utils/atoms/config'
import { getLocalConfig } from '@/utils/config/storage'
import { DEFAULT_CONFIG } from '@/utils/constants/config'
import { queryClient } from '@/utils/tanstack-query'
import App from './app'
import '@/assets/styles/theme.css'

interface HydrateAtomsProps {
  initialValues: [[typeof configAtom, Config]]
  children: React.ReactNode
}

function HydrateAtoms({ initialValues, children }: HydrateAtomsProps) {
  useHydrateAtoms(initialValues)
  return children
}

async function initApp() {
  const root = document.getElementById('root')!
  root.className = 'text-base antialiased min-h-screen bg-background'

  const config = (await getLocalConfig()) ?? DEFAULT_CONFIG

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <JotaiProvider>
          <HydrateAtoms initialValues={[[configAtom, config]]}>
            <ThemeProvider>
              <TooltipProvider>
                <App />
                {import.meta.env.DEV && <Agentation />}
                <FrogToast />
              </TooltipProvider>
            </ThemeProvider>
          </HydrateAtoms>
        </JotaiProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  )
}

void initApp()
