import { cn } from "@/utils/styles/utils"

function Container({
  ref,
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { ref?: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div
      ref={ref}
      className={cn("mx-auto w-full max-w-7xl px-6 md:px-8 lg:px-14", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export default Container
