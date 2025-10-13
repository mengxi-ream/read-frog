'use client'

import { cn } from '@repo/ui/lib/utils'
import { IconCircleFilled, IconLock } from '@tabler/icons-react'

interface MacBrowserShellProps {
  children: React.ReactNode
  className?: string
}

export function MacBrowserShell({ children, className }: MacBrowserShellProps) {
  return (
    <div className={cn(
      'bg-white dark:bg-zinc-800 rounded-lg shadow-sm overflow-hidden mx-auto',
      'border border-gray-200 dark:border-gray-800',
      className,
    )}
    >
      <div className="md:px-4 px-3 md:py-2 py-2 flex items-center relative">
        <div className="flex md:space-x-2 space-x-1.5 mr-4 absolute">
          <IconCircleFilled className="size-3 text-red-500" />
          <IconCircleFilled className="size-3 text-yellow-500" />
          <IconCircleFilled className="size-3 text-green-500" />
        </div>
        <div className="relative flex flex-auto items-center justify-center px-3 py-2 gap-2 text-gray-600 dark:text-gray-400">
          <IconLock className="size-4" />
          <span className="md:text-sm text-xs truncate">
            https://readfrog.app
          </span>
        </div>
      </div>
      <div className="h-full overflow-hidden">
        {children}
      </div>
    </div>
  )
}
