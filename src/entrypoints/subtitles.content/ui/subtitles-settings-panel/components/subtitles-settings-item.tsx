import { Label } from "@/components/ui/base-ui/label"

interface SubtitlesSettingsItemProps {
  icon: React.ReactNode
  label: React.ReactNode
  labelFor: string
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
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="shrink-0 text-white/82">
          {icon}
        </div>
        <Label
          htmlFor={labelFor}
          className="font-light! block min-w-0 cursor-pointer rounded-md py-0.5 text-left text-[13px] leading-5 text-white/96 transition-colors hover:text-white"
        >
          {label}
        </Label>
      </div>

      <div className="shrink-0">
        {children}
      </div>
    </div>
  )
}
