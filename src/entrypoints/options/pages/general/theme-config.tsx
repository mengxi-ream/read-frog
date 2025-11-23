import type { ThemeMode } from '@/utils/atoms/theme'
import { Icon } from '@iconify/react'
import { useTheme } from '@/components/providers/theme-provider'
import { Field, FieldLabel } from '@/components/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/select'
import { ConfigCard } from '../../components/config-card'

export function ThemeConfig() {
  const { themeMode, setThemeMode } = useTheme()

  const handleThemeChange = async (value: ThemeMode) => {
    await setThemeMode(value)
  }

  return (
    <ConfigCard
      title="Theme"
      description="Choose your preferred color theme for the extension interface."
    >
      <Field>
        <FieldLabel htmlFor="theme-mode">
          Theme Mode
        </FieldLabel>
        <Select value={themeMode} onValueChange={handleThemeChange}>
          <SelectTrigger id="theme-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">
              <div className="flex items-center gap-2">
                <Icon icon="tabler:sun" className="size-4" />
                <span>Light</span>
              </div>
            </SelectItem>
            <SelectItem value="dark">
              <div className="flex items-center gap-2">
                <Icon icon="tabler:moon" className="size-4" />
                <span>Dark</span>
              </div>
            </SelectItem>
            <SelectItem value="system">
              <div className="flex items-center gap-2">
                <Icon icon="tabler:device-desktop" className="size-4" />
                <span>System</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </ConfigCard>
  )
}
