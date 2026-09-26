import type { ReactNode, Ref } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Label } from "@/components/ui/base-ui/label"
import { cn } from "@/utils/styles/utils"

interface SubpageMenuEntryProps {
  icon?: ReactNode
  label: string
  onClick: () => void
  /** Set only for rows that toggle something rather than navigate. */
  pressed?: boolean
  ref?: Ref<HTMLButtonElement>
}

export function SubpageMenuEntry({ icon, label, onClick, pressed, ref }: SubpageMenuEntryProps) {
  return (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      onClick={onClick}
      aria-pressed={pressed}
      className={cn("h-auto w-full justify-start rounded-lg px-2 py-1.5 text-left")}
    >
      <div className="flex items-center gap-2">
        <div className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <Label className="cursor-pointer text-left text-xs leading-5 font-light!">{label}</Label>
        </div>
      </div>
    </Button>
  )
}
