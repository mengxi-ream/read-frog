import { Label } from "@/components/ui/base-ui/label"

interface SubtitlesSettingsItemProps {
  icon: React.ReactNode
  label: React.ReactNode
  labelFor?: string
  children: React.ReactNode
}

export function SubtitlesSettingsItem({
  icon,
  label,
  labelFor,
  children,
}: SubtitlesSettingsItemProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50">
      <Label
        htmlFor={labelFor}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md text-left text-xs leading-5 font-light! transition-colors"
      >
        <div className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0 flex-1">{label}</div>
      </Label>

      <div className="shrink-0">{children}</div>
    </div>
  )
}
