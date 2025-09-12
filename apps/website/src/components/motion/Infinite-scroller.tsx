import type { ReactNode } from 'react'
import { cn } from '@repo/ui/lib/utils'

type Orientation = 'horizontal' | 'vertical'

const animateClassNameMap: Record<Orientation, string> = {
  horizontal: 'animate-[marquee_linear_infinite]',
  vertical: 'animate-[marquee-vertical_linear_infinite]',
}

export function InfiniteScroller<T extends { id: number | string }>({
  cardSequence,
  renderCard,
  className,
  duration = 50,
  orientation = 'horizontal',
}: {
  cardSequence: T[]
  renderCard: (card: T) => ReactNode
  className?: string
  duration?: number
  orientation?: Orientation
}) {
  // use two same part to implement animate
  return (
    <div
      className={cn('flex items-center py-5 w-full overflow-hidden group', className)}
    >
      <InfiniteScrollerPart duration={duration} cardSequence={cardSequence} renderCard={renderCard} orientation={orientation} />
      <InfiniteScrollerPart duration={duration} cardSequence={cardSequence} renderCard={renderCard} orientation={orientation} />
    </div>
  )
}

function InfiniteScrollerPart<T extends { id: number | string }>({
  cardSequence,
  renderCard,
  duration,
  orientation,
}: {
  cardSequence: T[]
  renderCard: (card: T) => ReactNode
  duration?: number
  orientation: Orientation
}) {
  return (
    <div
      className={
        cn(
          'flex p-px group-hover:[animation-play-state:paused]',
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
