import { IconBackground, IconPencilMinus, IconViewfinder, IconWorld } from '@tabler/icons-react'

export function LittleFeatureGrid() {
  const features = [
    {
      icon: <IconWorld className="size-4 text-primary" />,
      title: '多国语言',
      description: '翻译支持多种语言，包括英语、法语、德语、西班牙语等。',
    },
    {
      icon: <IconPencilMinus className="size-4 text-primary" />,
      title: '划词翻译',
      description: '允许划词翻译，即时解析所需内容，同时支持保存生词本，所见即所得。',
    },
    {
      icon: <IconBackground className="size-4 text-primary" />,
      title: '上下文结合',
      description: '翻译自动携带上下文，使您能够获得更准确的翻译效果。',
    },
    {
      icon: <IconViewfinder className="size-4 text-primary" />,
      title: '多种格式',
      description: '后续将支持阅读或翻译多种格式，如：pdf，视频，漫画',
      badge: 'soon',
    },
  ]

  return (
    <section className="h-70 md:h-45 gap-12 border-t border-zinc-200 dark:border-zinc-800">
      <div className="grid grid-cols-2 grid-rows-2 md:grid-cols-4 md:grid-rows-1 gap-x-6 gap-y-8 md:gap-10 mx-auto max-w-6xl h-full px-6 py-8">
        {features.map(feature => (
          <WidgetCard key={feature.title} {...feature} />
        ))}
      </div>
    </section>
  )
}

function WidgetCard({ icon, title, description, badge }: { icon: React.ReactNode, title: string, description: string, badge?: string }) {
  return (
    <section className="w-full flex flex-col items-start justify-start gap-2 text-base my-auto">
      <header className="flex items-center justify-start gap-2 w-full text-sm ">
        {icon}
        <span className="text-sm whitespace-nowrap font-medium">{title}</span>
        {badge && (
          <span className="flex justify-center items-center leading-3 rounded-full gap-1 px-2 py-1 text-sm bg-primary-fill border border-primary-strong text-primary">
            {badge}
          </span>
        )}
      </header>
      <div className="text-sm text-gray-600 dark:text-gray-400 justify-start text-left">{description}</div>
    </section>
  )
}
