import { IconBackground, IconPencilMinus, IconViewfinder, IconWorld } from '@tabler/icons-react'
import { useTranslations } from 'next-intl'

export function LittleFeatureGrid() {
  const t = useTranslations('features.littleFeatures')

  const features = [
    {
      icon: <IconWorld className="size-4" />,
      title: t('multiLanguageSupport'),
      description: t('multiLanguageSupportExplanation'),
    },
    {
      icon: <IconPencilMinus className="size-4" />,
      title: t('selectionTranslate'),
      description: t('selectionTranslateExplanation'),
    },
    {
      icon: <IconBackground className="size-4" />,
      title: t('context'),
      description: t('contextExplanation'),
    },
    {
      icon: <IconViewfinder className="size-4" />,
      title: t('multiFormatSupport'),
      description: t('multiFormatSupportExplanation'),
      badge: 'soon',
    },
  ]

  return (
    <section className="gap-12 border-t border-zinc-200 dark:border-zinc-800">
      <div className="grid grid-cols-2 grid-rows-2 md:grid-cols-4 md:grid-rows-1 gap-x-6 gap-y-6 md:gap-10 mx-auto max-w-6xl h-fit px-6 py-10 md:py-14">
        {features.map(feature => (
          <WidgetCard key={feature.title} {...feature} />
        ))}
      </div>
    </section>
  )
}

function WidgetCard({ icon, title, description, badge }: { icon: React.ReactNode, title: string, description: string, badge?: string }) {
  return (
    <section className="w-full flex flex-col items-start justify-start gap-2 text-base my-auto h-full">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-start gap-2 w-full text-sm">
        <span className="text-primary whitespace-nowrap">{icon}</span>
        <div className="w-full flex gap-2">
          <span className="text-sm whitespace-nowrap font-medium">{title}</span>
          {badge && (
            <span className="flex justify-center items-center leading-3 rounded-full px-2 py-1 text-sm bg-primary-fill border border-primary-strong text-primary">
              {badge}
            </span>
          )}
        </div>
      </header>
      <div className="text-sm text-gray-600 dark:text-gray-400 justify-start text-left">{description}</div>
    </section>
  )
}
