'use client'

import type React from 'react'
import { cn } from '@repo/ui/lib/utils'
import { motion } from 'motion/react'

interface CoinAnimationProps {
  wallet: React.ReactNode
  coins: React.ReactNode[]
  className?: string
  radius?: number
  duration?: number
  repeatDelay?: number
}

export function Wallet({
  wallet,
  coins,
  className,
  radius = 100,
  duration = 5,
  repeatDelay = 1,
}: CoinAnimationProps) {
  const coinCount = coins.length

  const coinTimes = [0, 0.10, 0.20, 0.45, 0.68, 0.85, 0.9, 1]

  const walletKeyframes = {
    x: [0, 0, 0, 0, 0, 0, -6, 0],
    y: [0, 0, 0, 0, 0, 0, -4, 0],
    opacity: [1, 0, 0, 0, 0, 1, 1, 1],
  }

  const walletTimes = [0, 0.10, 0.20, 0.45, 0.68, 0.85, 0.9, 1]

  const generateCoinAnimations = () => {
    const animations = []

    for (let i = 0; i < Math.min(coinCount, coins.length); i++) {
      const angle = (i / coinCount) * Math.PI * 2
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius

      animations.push({
        key: i,
        animate: {
          rotateY: [0, 0, 180, 180, 180, 0, 0, 0],
          x: [0, x, x, x, x, 0, 0, 0],
          y: [0, y, y, y, y, 0, 0, 0],
          opacity: [1, 1, 1, 1, 1, 1, 0, 0],
        },
      })
    }
    return animations
  }

  const coinAnimations = generateCoinAnimations()

  return (
    <div className={cn('relative w-full h-full', className)}>
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute z-10 w-full h-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          animate={walletKeyframes}
          transition={{
            duration,
            repeat: Infinity,
            repeatDelay,
            ease: 'easeInOut',
            times: walletTimes,
          }}
        >
          <div className="absolute inset-0 grid place-items-center">
            {wallet}
          </div>
        </motion.div>
      </div>

      <div className="absolute inset-0 pointer-events-none">
        {coinAnimations.map((animation, index) => (
          <motion.div
            key={animation.key}
            className="absolute w-full h-full transform-3d perspective-normal origin-center top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            initial={{ x: 0, y: 0, rotateY: 0, opacity: 1 }}
            animate={animation.animate}
            transition={{
              duration,
              ease: 'easeInOut',
              times: coinTimes,
              repeat: Infinity,
              repeatDelay,
            }}
          >
            <div className="absolute backface-hidden inset-0 grid place-items-center">
              {wallet}
            </div>
            <div className="absolute backface-hidden inset-0 grid place-items-center transform-3d rotate-y-180">
              {coins[index % coins.length]}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
