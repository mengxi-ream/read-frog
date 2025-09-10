import type { ReactNode } from 'react'
import { cn } from '@repo/ui/lib/utils'

export function InfiniteHorizontalScroller<T extends { id: number | string }>({
  cardSequence,
  renderCard,
  className,
  duration = 100,
}: {
  cardSequence: T[]
  renderCard: (card: T) => ReactNode
  className?: string
  duration?: number
}) {
  // use two same part to implement animate
  return (
    <div
      className={cn('flex items-center py-5 w-full overflow-hidden group', className)}
    >
      <InfiniteHorizontalPart duration={duration} cardSequence={cardSequence} renderCard={renderCard} />
      <InfiniteHorizontalPart duration={duration} cardSequence={cardSequence} renderCard={renderCard} />
    </div>
  )
}

function InfiniteHorizontalPart<T extends { id: number | string }>({
  cardSequence,
  renderCard,
  duration,
}: {
  cardSequence: T[]
  renderCard: (card: T) => ReactNode
  duration?: number
}) {
  return (
    <div
      className="flex p-px animate-[marquee_linear_infinite] group-hover:[animation-play-state:paused]"
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
