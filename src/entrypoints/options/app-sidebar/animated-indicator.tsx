interface AnimatedIndicatorProps {
  show: boolean
}

export function AnimatedIndicator({ show }: AnimatedIndicatorProps) {
  if (!show)
    return null

  return (
    <span className="absolute top-1/2 right-2 flex items-center justify-center size-2.5 -translate-y-1/2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75"></span>
      <span className="relative inline-flex size-2 rounded-full bg-brand"></span>
    </span>
  )
}
