'use client'

import type { TestimonialItem } from '@/utils/constants/testimonial-list'
import { cn } from '@repo/ui/lib/utils'
import Image from 'next/image'
import { testimonialList } from '@/utils/constants/testimonial-list'

export function Testimonial() {
  return (
    <section className="w-full border-t border-zinc-200 bg-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
      <div className="relative">
        { testimonialList.map(testimonial => <TestimonialCard testimonial={testimonial} key={testimonial.id} />) }
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-fd-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-fd-background to-transparent" />
      </div>
    </section>
  )
}

function TestimonialCard({ testimonial }: { testimonial: TestimonialItem }) {
  return (
    <div
      className="shrink-0 w-72 md:w-80 h-40 rounded-xl border border-fd-border bg-fd-card/60 backdrop-blur p-4 mx-3"
    >
      <div className="flex items-center gap-3 mb-3 h-9">
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
        <div className="min-w-0 flex flex-auto flex-col h-full gap-1 justify-between">
          <p className="text-sm font-medium truncate">
            {testimonial.name}
          </p>
          {testimonial.from && (
            <p className="text-xs text-fd-muted-foreground truncate">
              {testimonial.from}
            </p>
          )}
        </div>
      </div>
      <p className="text-sm text-fd-foreground/90 leading-relaxed overflow-hidden text-ellipsis line-clamp-3">
        {testimonial.comment}
      </p>
    </div>
  )
}

function CommentAvatar({ link, avatar, name }: { avatar?: string, name: string, link?: string }) {
  const Wrapper = link ? 'a' : 'div'

  return (
    <Wrapper href={link} target="_blank" rel="noopener noreferrer">
      {avatar ? <Image src={avatar} alt={name} width={48} height={48} className="size-full object-cover" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}
    </Wrapper>
  )
}
