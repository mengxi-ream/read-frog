'use client'

import type { UserComment } from '@/utils/constants/user-comments'
import { cn } from '@repo/ui/lib/utils'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { InfiniteHorizontalScroller } from '@/components/motion/infinite-horizontal-scroller'
import { userComments } from '@/utils/constants/user-comments'

export function UserComments() {
  return (
    <section className="w-full border-t border-zinc-200 bg-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
      <div className="relative">
        <InfiniteHorizontalScroller
          renderCard={card => <CommentCard comment={card} />}
          cardSequence={userComments}
        />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-fd-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-fd-background to-transparent" />
      </div>
    </section>
  )
}

function CommentCard({ comment }: { comment: UserComment }) {
  const t = useTranslations('comment')

  return (
    <div
      className="shrink-0 w-72 md:w-80 h-40 rounded-xl border border-fd-border bg-fd-card/60 backdrop-blur p-4 mx-3"
    >
      <div className="flex items-center gap-3 mb-3 h-9">
        <div
          className={
            cn(
              `size-9 rounded-full bg-fd-muted overflow-hidden grid place-items-center text-sm`,
              comment.link ? 'cursor-pointer' : '',
            )
          }
        >
          <CommentAvatar link={comment.link} avatar={comment.avatar} name={comment.name} />
        </div>
        <div className="min-w-0 flex flex-auto flex-col h-full gap-1 justify-between">
          <p className="text-sm font-medium truncate">
            {comment.name}
          </p>
          {comment.from && (
            <p className="text-xs text-fd-muted-foreground truncate">
              {t('from')}
              {' '}
              {comment.from}
            </p>
          )}
        </div>
      </div>
      <p className="text-sm text-fd-foreground/90 leading-relaxed overflow-hidden text-ellipsis line-clamp-3">
        {comment.comment}
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
