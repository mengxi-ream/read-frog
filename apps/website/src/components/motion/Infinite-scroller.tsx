import type { ReactNode } from 'react'
import { cn } from '@repo/ui/lib/utils'

type Orientation = 'horizontal' | 'vertical'

const animateClassNameMap: Record<Orientation, string> = {
  horizontal: 'animate-[marquee_linear_infinite]',
  vertical: 'animate-[marquee-vertical_linear_infinite]',
}

export function InfiniteScroller<T extends { id: number | string }>({
  className,
  orientation = 'horizontal',
  repeatCount = 2,
  ...props
}: {
  cardSequence: T[]
  renderCard: (card: T) => ReactNode
  repeatCount?: number
  className?: string
  duration?: number
  orientation?: Orientation
  reverse?: boolean
}) {
  // use same part to implement animate
  const repeatCountArray = Array.from({ length: repeatCount }, (_, index) => index)

  return (
    <div
      className={cn('relative flex items-center w-full overflow-hidden group', className)}
    >
      {repeatCountArray.map(count => (
        <InfiniteScrollerPart key={count} orientation={orientation} {...props} />
      ))}
      {orientation === 'horizontal' ? <HorizontalMask /> : <VerticalMask />}
    </div>
  )
}

function HorizontalMask() {
  return (
    <>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-8 md:w-16 bg-gradient-to-r from-white dark:from-zinc-950 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 md:w-16 bg-gradient-to-l from-white dark:from-zinc-950 to-transparent" />
    </>
  )
}

function VerticalMask() {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 w-8 md:h-16 bg-gradient-to-b from-white dark:from-zinc-950 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 w-8 md:h-16 bg-gradient-to-t from-white dark:from-zinc-950 to-transparent" />
    </>
  )
}

function InfiniteScrollerPart<T extends { id: number | string }>({
  cardSequence,
  renderCard,
  duration = 20,
  orientation = 'horizontal',
  reverse = false,
}: {
  cardSequence: T[]
  renderCard: (card: T) => ReactNode
  duration?: number
  orientation?: Orientation
  reverse?: boolean
}) {
  return (
    <div
      className={
        cn(
          'flex p-px group-hover:[animation-play-state:paused]',
          reverse ? '[animation-direction:reverse]' : '',
          animateClassNameMap[orientation],
        )
      }
      style={{
        animationDuration: `${duration}s`,
      }}
    >
      {cardSequence.map(card => (
        <div key={card.id}>
          {renderCard(card)}
        </div>
      ))}
    </div>
  )
}
