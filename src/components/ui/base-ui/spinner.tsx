import { IconLoader } from "@tabler/icons-react"
import { cn } from "@/utils/styles/utils"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <IconLoader role="status" aria-label="Loading" className={cn("size-4 animate-spin", className)} {...props} />
  )
}

export { Spinner }
