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
      'bg-gray-100 dark:bg-gray-900 rounded-lg shadow-2xl overflow-hidden',
      'border border-gray-200 dark:border-gray-700 h-full',
      className,
    )}
    >
      <div className="bg-gray-200 dark:bg-gray-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>

        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        <div className="flex items-center bg-white dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2">
          <svg className="w-4 h-4 text-gray-500 dark:text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate text-center">
            {url}
          </span>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 h-full">
        {children}
      </div>
    </div>
  )
}
