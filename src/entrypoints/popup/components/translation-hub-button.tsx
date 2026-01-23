import { browser, i18n } from '#imports'
import { Icon } from '@iconify/react'
import { Button } from '@/components/base-ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shadcn/tooltip'

export function TranslationHubButton() {
  const handleClick = async () => {
    await browser.tabs.create({
      url: browser.runtime.getURL('/translation-hub.html'),
    })
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClick}
        >
          <Icon icon="tabler:language-hiragana" />
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[200px] text-wrap">
        {i18n.t('popup.hub.tooltip')}
      </TooltipContent>
    </Tooltip>
  )
}
