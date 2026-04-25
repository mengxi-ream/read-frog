import type { ReactNode } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Label } from "@/components/ui/base-ui/label"
import { cn } from "@/utils/styles/utils"

interface SubpageMenuEntryProps {
  icon?: ReactNode
  label: string
  onClick: () => void
}

export function SubpageMenuEntry({
  icon,
  label,
  onClick,
}: SubpageMenuEntryProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={cn("h-auto w-full justify-start rounded-[14px] px-2 py-2 text-left")}
    >
      <div className="flex items-center gap-3">
        <div className="text-muted-foreground shrink-0">
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <Label className="font-light! cursor-pointer text-left text-[13px] leading-5">
            {label}
          </Label>
        </div>
      </div>
    </Button>
  )
}
