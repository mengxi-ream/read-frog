import type { ReactNode } from 'react'
import { cn } from '@repo/ui/lib/utils'

type Orientation = 'horizontal' | 'vertical'

const animateClassNameMap: Record<Orientation, string> = {
  horizontal: 'animate-[marquee_linear_infinite]',
  vertical: 'animate-[marquee_vertical_linear_infinite]',
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
      className={cn(
        'relative flex items-center overflow-hidden w-full group',
        className,
      )}
    >
      {repeatCountArray.map(count => (
        <InfiniteScrollerPart key={count} orientation={orientation} {...props} />
      ))}
    </div>
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
