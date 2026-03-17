import { cn } from "@/utils/styles/utils"

const THINKING_DOTS = [
  { cx: 12.5, cy: 12.5, begin: "0s" },
  { cx: 12.5, cy: 52.5, begin: "100ms", fillOpacity: 0.5 },
  { cx: 52.5, cy: 12.5, begin: "300ms" },
  { cx: 52.5, cy: 52.5, begin: "600ms" },
  { cx: 92.5, cy: 12.5, begin: "800ms" },
  { cx: 92.5, cy: 52.5, begin: "400ms" },
  { cx: 12.5, cy: 92.5, begin: "700ms" },
  { cx: 52.5, cy: 92.5, begin: "500ms" },
  { cx: 92.5, cy: 92.5, begin: "200ms" },
] as const

interface ThinkingIconProps extends React.ComponentProps<"svg"> {
  animated?: boolean
}

export function ThinkingIcon({
  animated = true,
  className,
  ...props
}: ThinkingIconProps) {
  return (
    <svg
      viewBox="0 0 105 105"
      fill="currentColor"
      className={cn("size-2.5", className)}
      {...props}
    >
      {THINKING_DOTS.map(dot => (
        <circle
          key={`${dot.cx}-${dot.cy}`}
          cx={dot.cx}
          cy={dot.cy}
          r="12.5"
          fillOpacity={animated ? ("fillOpacity" in dot ? dot.fillOpacity : 1) : 1}
        >
          {animated && (
            <animate
              attributeName="fill-opacity"
              begin={dot.begin}
              dur="1s"
              values="1;.2;1"
              calcMode="linear"
              repeatCount="indefinite"
            />
          )}
        </circle>
      ))}
    </svg>
  )
}
