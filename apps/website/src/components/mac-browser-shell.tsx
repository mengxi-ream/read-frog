'use client'

import { cn } from '@repo/ui/lib/utils'

interface MacBrowserShellProps {
  children: React.ReactNode
  url?: string
  className?: string
}

export function MacBrowserShell({
  children,
  url = 'https://example.com',
  className,
}: MacBrowserShellProps) {
  return (
    <div className={cn(
      'bg-zinc-50 dark:bg-zinc-900 rounded-lg shadow-2xl overflow-hidden',
      'border border-gray-200 dark:border-gray-700 h-full',
      'md:max-w-none max-w-md mx-auto',
      className,
    )}
    >
      <div className="md:px-4 px-3 md:py-2 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-2 w-full">
          <div className="flex md:space-x-2 space-x-1.5">
            <div className="md:w-3 md:h-3 w-2.5 h-2.5 rounded-full bg-red-500" />
            <div className="md:w-3 md:h-3 w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <div className="md:w-3 md:h-3 w-2.5 h-2.5 rounded-full bg-green-500" />
          </div>
          <div className="flex flex-auto items-center justify-center px-3 py-2 text-gray-600 dark:text-gray-400">
            <svg className="md:w-4 md:h-4 w-3.5 h-3.5 text-gray-500 dark:text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="md:text-sm text-xs flex-1 truncate text-center">
              {url}
            </span>
          </div>
          <div></div>
        </div>

      </div>
      <div className="h-full overflow-hidden">
        {children}
      </div>
    </div>
  )
}
