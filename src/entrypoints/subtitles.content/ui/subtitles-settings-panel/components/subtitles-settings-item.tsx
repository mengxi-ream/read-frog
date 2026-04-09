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
    <div className="flex items-center gap-3 rounded-[14px] px-2 py-2 transition-colors hover:bg-white/4.5">
      <Label
        htmlFor={labelFor}
        className="font-light! flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md py-0.5 text-left text-[13px] leading-5 text-white/96 transition-colors hover:text-white"
      >
        <div className="shrink-0 text-white/82">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          {label}
        </div>
      </Label>

      <div className="shrink-0">
        {children}
      </div>
    </div>
  )
}
