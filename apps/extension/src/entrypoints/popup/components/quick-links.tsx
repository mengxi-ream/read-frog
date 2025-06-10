import bookIcon from '@/assets/icon/book.svg'
import discordIcon from '@/assets/icon/discord.svg'
import helpIcon from '@/assets/icon/help.svg'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const LINKS: {
  label: 'help' | 'book' | 'discord'
  icon: string
  url: string
}[] = [
  {
    label: 'book',
    icon: bookIcon,
    url: 'https://neat-reader.cloudb.pub/',
  },
  {
    label: 'discord',
    icon: discordIcon,
    url: 'https://discord.gg/ej45e3PezJ',
  },
  {
    label: 'help',
    icon: helpIcon,
    url: 'https://readfrog.app/tutorial/',
  },
]

export default function QuickLinks() {
  return (
    <div className="flex justify-between">
      {LINKS.map(link => (
        <LinkCard key={link.url} link={link} />
      ))}
    </div>
  )
}

function LinkCard({ link }: { link: (typeof LINKS)[number] }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="border-border bg-input/50 hover:bg-input flex w-20 flex-col items-center justify-center gap-1.5 rounded-md border py-3 text-sm"
        >
          <img src={link.icon} alt={link.label} className="size-5" />
          {i18n.t(`popup.${link.label}.title`)}
        </a>
      </TooltipTrigger>
      <TooltipContent className="max-w-[210px] break-words text-center">
        {i18n.t(`popup.${link.label}.description`)}
      </TooltipContent>
    </Tooltip>
  )
}
