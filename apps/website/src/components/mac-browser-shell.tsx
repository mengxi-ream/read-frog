'use client'

import { cn } from '@repo/ui/lib/utils'
import { IconLock } from '@tabler/icons-react'

interface MacBrowserShellProps {
  children: React.ReactNode
  className?: string
}

export function MacBrowserShell({ children, className }: MacBrowserShellProps) {
  return (
    <div className={cn(
      'bg-zinc-50 dark:bg-zinc-900 rounded-lg shadow-2xl overflow-hidden',
      'border border-gray-200 dark:border-gray-700 h-full',
      'md:max-w-none max-w-md mx-auto',
      className,
    )}
    >
      <div className="md:px-4 px-3 md:py-2 py-2 flex items-center">
        <div className="flex md:space-x-2 space-x-1.5 mr-4">
          <div className="md:w-3 md:h-3 w-2.5 h-2.5 rounded-full bg-red-500" />
          <div className="md:w-3 md:h-3 w-2.5 h-2.5 rounded-full bg-yellow-500" />
          <div className="md:w-3 md:h-3 w-2.5 h-2.5 rounded-full bg-green-500" />
        </div>
        <div className="relative flex flex-auto items-center justify-center px-3 py-2 gap-2 text-gray-600 dark:text-gray-400 -left-5">
          <IconLock className="size-4" />
          <span className="md:text-sm text-xs truncate">
            https://readfrog.app
          </span>
        </div>
        <div className="w-[34px]"></div>
      </div>
      <div className="h-full overflow-hidden">
        {children}
      </div>
    </div>
  )
}
