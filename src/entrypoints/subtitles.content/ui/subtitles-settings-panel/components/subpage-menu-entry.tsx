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
      className={cn("h-auto w-full justify-start rounded-[14px] px-2 py-2 text-left text-white/96 hover:bg-white/4.5 hover:text-white")}
    >
      <div className="flex items-center gap-3">
        <div className="shrink-0 text-white/82">
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <Label className="font-light! cursor-pointer text-left text-[13px] leading-5 text-white/96 transition-colors hover:text-white">
            {label}
          </Label>
        </div>
      </div>
    </Button>
  )
}
