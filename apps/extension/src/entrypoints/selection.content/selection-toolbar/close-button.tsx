import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu'
import { useAtom } from 'jotai'
import { useState } from 'react'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { shadowWrapper } from '../'

export function CloseButton() {
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  return (
    <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <div
          title="Close selection toolbar"
          className={`border-border absolute -top-1 -right-1 cursor-pointer rounded-full border bg-neutral-100 dark:bg-neutral-900 ${isDropdownOpen ? 'block' : 'hidden group-hover:block'}`}
          onMouseDown={e => e.stopPropagation()}
        >
          <Icon icon="tabler:x" className="h-3 w-3 text-neutral-400 dark:text-neutral-600" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right" className="z-[2147483647]" container={shadowWrapper} hideWhenDetached>
        <DropdownMenuItem
          onMouseDown={e => e.stopPropagation()}
          onClick={() => {
            const currentDomain = window.location.hostname
            const currentPatterns = selectionToolbar.disabledSelectionToolbarPatterns || []
            void setSelectionToolbar({
              ...selectionToolbar,
              disabledSelectionToolbarPatterns: [...currentPatterns, currentDomain],
            })
          }}
        >
          {i18n.t('options.floatingButtonAndToolbar.selectionToolbar.closeMenu.disableForSite')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onMouseDown={e => e.stopPropagation()}
          onClick={() => {
            void setSelectionToolbar({ ...selectionToolbar, enabled: false })
          }}
        >
          {i18n.t('options.floatingButtonAndToolbar.selectionToolbar.closeMenu.disableGlobally')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
