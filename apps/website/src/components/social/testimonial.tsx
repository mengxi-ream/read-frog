'use client'

import type { TestimonialItem } from '@/utils/constants/testimonial-list'
import { cn } from '@repo/ui/lib/utils'
import { motion } from 'motion/react'
import { useTheme } from 'next-themes'
import Image from 'next/image'
import { useHydration } from '@/hooks/useHydration'
import { FromPlatforms, testimonialList } from '@/utils/constants/testimonial-list'

export function Testimonial() {
  return (
    <section className="w-full border-t border-zinc-200 bg-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 mx-auto px-4 py-8 ">
      <div className="mx-auto max-w-3xl columns-1 md:columns-2 gap-4">
        { testimonialList.map(testimonial => <TestimonialCard testimonial={testimonial} key={testimonial.id} />) }
      </div>
    </section>
  )
}

function TestimonialCard({ testimonial }: { testimonial: TestimonialItem }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{
        ease: 'easeInOut',
        duration: 0.8,
        delay: 0.2,
      }}
      className="break-inside-avoid h-fit mb-4 last:mb-0 rounded-xl border border-fd-border bg-fd-card/60 backdrop-blur p-6 flex flex-col gap-4"
    >
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={
              cn(
                `size-9 rounded-full bg-fd-muted overflow-hidden grid place-items-center text-sm`,
                testimonial.link ? 'cursor-pointer' : '',
              )
            }
          >
            <CommentAvatar link={testimonial.link} avatar={testimonial.avatar} name={testimonial.name} />
          </div>
          <div className="min-w-0 flex flex-auto flex-col h-full justify-between gap-1">
            <h3 className="text-base font-medium truncate">{testimonial.name}</h3>
            <h4 className="text-sm leading-none line-truncate text-gray-600 dark:text-gray-400">{testimonial.date}</h4>
          </div>
        </div>
        <BrandLogo brand={testimonial.from} />
      </header>
      <p className="text-base text-fd-foreground/90 leading-relaxed">
        {testimonial.comment}
      </p>
    </motion.div>
  )
}

function BrandLogo({ brand }: { brand: FromPlatforms }) {
  const { resolvedTheme } = useTheme()
  const isHydrated = useHydration()

  const isDark = isHydrated && resolvedTheme === 'dark'

  const squareLogoSize = 25
  const circleLogoSize = 28
  const logoSize = [FromPlatforms.X].includes(brand) ? squareLogoSize : circleLogoSize

  const logoSrc = [FromPlatforms.X].includes(brand) && isDark ? `/icons/${brand}-dark.png` : `/icons/${brand}.png`

  return <Image className="self-start" src={logoSrc} alt={brand} width={logoSize} height={logoSize} loading={!isHydrated ? 'eager' : 'lazy'} />
}

function CommentAvatar({ link, avatar, name }: { avatar?: string, name: string, link?: string }) {
  const Wrapper = link ? 'a' : 'div'

  return (
    <Wrapper href={link} target="_blank" rel="noopener noreferrer">
      {avatar ? <Image src={avatar} alt={name} width={36} height={36} /> : <span>{name.slice(0, 1).toUpperCase()}</span>}
    </Wrapper>
  )
}
