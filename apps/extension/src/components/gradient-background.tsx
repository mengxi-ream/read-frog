import type { ReactNode } from 'react'
import { cn } from '@repo/ui/lib/utils'
import { useId } from 'react'

interface GradientBackgroundProps {
  children: ReactNode
  className?: string
}

export function GradientBackground({ children, className }: GradientBackgroundProps) {
  const filterId = useId()
  const svg = `<svg viewBox='0 0 500 500' xmlns='http://www.w3.org/2000/svg'>
  <filter id='${filterId}'>
    <feTurbulence
      type='fractalNoise'
      baseFrequency='0.9'
      numOctaves='2'
      stitchTiles='stitch'/>
    <feColorMatrix type='saturate' values='0'/>
  </filter>

  <rect width='100%' height='100%' filter='url(#${filterId})' opacity='0.03'/>
</svg>`

  return (
    <div
      className={cn('w-full py-8 flex items-center justify-center rounded-xl my-8', className)}
      style={{
        backgroundImage: [
          'radial-gradient(circle at 70% 10%, rgba(7 240 139 / 0.15), transparent)',
          'radial-gradient(circle at 0% 80%, rgba(233 246 54 / 0.1), transparent)',
          'radial-gradient(circle at 50% 50%, rgba(235 183 51 / 0.08), transparent)',
          `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
        ].join(', '),
      }}
    >
      {children}
    </div>
  )
}
