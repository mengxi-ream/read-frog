import type { ReactNode, Ref } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Label } from "@/components/ui/base-ui/label"
import { cn } from "@/utils/styles/utils"

interface SubpageMenuEntryProps {
  icon?: ReactNode
  label: ReactNode
  onClick: () => void
  /** Set only for rows that toggle something rather than navigate. */
  pressed?: boolean
  disabled?: boolean
  /** Shown at the row's end, e.g. the chevron of a row that opens a subpage. */
  trailing?: ReactNode
  className?: string
  ref?: Ref<HTMLButtonElement>
}

export function SubpageMenuEntry({
  icon,
  label,
  onClick,
  pressed,
  disabled,
  trailing,
  className,
  ref,
}: SubpageMenuEntryProps) {
  return (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      onClick={onClick}
      aria-pressed={pressed}
      disabled={disabled}
      className={cn(
        "h-auto w-full justify-start gap-2 rounded-lg px-2 py-1.5 text-left",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {icon && (
          <div className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
            {icon}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <Label className="cursor-pointer text-left text-xs leading-5 font-light!">{label}</Label>
        </div>
      </div>

      {trailing && (
        <div className="flex shrink-0 items-center text-muted-foreground">{trailing}</div>
      )}
    </Button>
  )
}
