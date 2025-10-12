'use client'

import { cn } from '@repo/ui/lib/utils'
import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'

interface ProgressTabItem {
  id: string
  label: string
}

interface ProgressTabsProps {
  items: ProgressTabItem[]
  activeIndex: number
  setActiveIndex: (index: number) => void
  interval?: number
  className?: string
}

const CIRCLE_RADIUS = 8
const CIRCLE_STROKE = 2
const CIRCLE_SIZE = 20
const CIRCLE_CENTER = 10
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS

function CircleIndicator({ interval }: { interval: number }) {
  return (
    <motion.svg width={CIRCLE_SIZE} height={CIRCLE_SIZE} viewBox={`0 0 ${CIRCLE_SIZE} ${CIRCLE_SIZE}`}>
      <circle
        cx={CIRCLE_CENTER}
        cy={CIRCLE_CENTER}
        r={CIRCLE_RADIUS}
        fill="none"
        stroke="currentColor"
        strokeWidth={CIRCLE_STROKE}
        className="text-zinc-300 dark:text-zinc-600"
      />
      <motion.circle
        cx={CIRCLE_CENTER}
        cy={CIRCLE_CENTER}
        r={CIRCLE_RADIUS}
        fill="none"
        stroke="currentColor"
        strokeWidth={CIRCLE_STROKE}
        className="text-primary"
        strokeDasharray={CIRCLE_CIRCUMFERENCE}
        strokeLinecap="round"
        initial={{ strokeDashoffset: CIRCLE_CIRCUMFERENCE }}
        animate={{ strokeDashoffset: 0 }}
        transition={{
          duration: interval / 1_000,
          ease: 'linear',
        }}
        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
      />
    </motion.svg>
  )
}

export function ProgressTabs({
  items,
  activeIndex,
  setActiveIndex,
  interval = 6_000,
  className,
}: ProgressTabsProps) {
  const frameIdRef = useRef<number>(0)

  useEffect(() => {
    let lastSwitchTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - lastSwitchTime

      if (elapsed >= interval) {
        setActiveIndex((activeIndex + 1) % items.length)
        lastSwitchTime = Date.now()
      }

      frameIdRef.current = requestAnimationFrame(animate)
    }

    frameIdRef.current = requestAnimationFrame(animate)

    return () => cancelAnimationFrame(frameIdRef.current)
  }, [activeIndex, items.length, setActiveIndex, interval])

  return (
    <div className={cn('flex flex-col', className)}>
      {items.map((item, index) => {
        const isActive = activeIndex === index

        return (
          <div key={item.id}>
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 flex-shrink-0">
                {isActive && <CircleIndicator interval={interval} />}
              </div>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                className={cn(
                  'py-2 text-md text-start font-medium transition-colors cursor-pointer',
                  isActive ? 'text-primary' : 'text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white',
                )}
              >
                {item.label}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
