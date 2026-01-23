import { browser, i18n } from '#imports'
import { Icon } from '@iconify/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu'
import { getReviewUrl } from '@/utils/utils'

export function MoreMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 hover:bg-neutral-300 dark:hover:bg-neutral-700"
        >
          <Icon icon="tabler:dots" className="size-4" strokeWidth={1.6} />
          <span className="text-[13px] font-medium">{i18n.t('popup.more.title')}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top">
        <DropdownMenuItem
          onClick={() => window.open('https://discord.gg/ej45e3PezJ', '_blank', 'noopener,noreferrer')}
          className="cursor-pointer"
        >
          <Icon icon="logos:discord-icon" className="size-4" strokeWidth={1.6} />
          {i18n.t('popup.more.joinDiscord')}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => window.open('https://github.com/mengxi-ream/read-frog/blob/main/assets/wechat-account.jpg', '_blank', 'noopener,noreferrer')}
          className="cursor-pointer"
        >
          <Icon icon="streamline-logos:wechat-logo-solid" className="size-4" strokeWidth={1.6} />
          {i18n.t('popup.more.joinWechat')}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => window.open('https://github.com/mengxi-ream/read-frog', '_blank', 'noopener,noreferrer')}
          className="cursor-pointer"
        >
          <Icon icon="fa7-brands:github" className="size-4" strokeWidth={1.6} />
          {i18n.t('popup.more.starGithub')}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => window.open(getReviewUrl('popup'), '_blank', 'noopener,noreferrer')}
          className="cursor-pointer"
        >
          <Icon icon="tabler:star" className="size-4" strokeWidth={1.6} />
          {i18n.t('popup.more.rateUs')}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => void browser.tabs.create({ url: browser.runtime.getURL('/translation-hub.html') })}
          className="cursor-pointer"
        >
          <Icon icon="tabler:language-hiragana" className="size-4" strokeWidth={1.6} />
          {i18n.t('popup.more.translationHub')}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => window.open('https://www.neat-reader.com/webapp#/', '_blank', 'noopener,noreferrer')}
          className="cursor-pointer"
        >
          <Icon icon="tabler:book" className="size-4" strokeWidth={1.6} />
          {i18n.t('popup.more.ebook')}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => window.open('https://readfrog.app/tutorial/', '_blank', 'noopener,noreferrer')}
          className="cursor-pointer"
        >
          <Icon icon="tabler:help-circle" className="size-4" strokeWidth={1.6} />
          {i18n.t('popup.more.tutorial')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
