import { cn } from '@/utils/styles/utils'

interface LoadingDotsProps {
  className?: string
}

export default function LoadingDots({ className }: LoadingDotsProps) {
  return (
    <div
      className={cn('flex items-center justify-center gap-[3px]', className)}
    >
      {[...Array.from({ length: 3 })].map((_, i) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className="h-1.5 w-1 animate-bounce rounded-full bg-black dark:bg-white"
          style={{
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  )
}
