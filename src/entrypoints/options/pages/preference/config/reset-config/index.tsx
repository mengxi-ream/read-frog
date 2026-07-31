import { IconRefresh } from "@tabler/icons-react"
import { useSetAtom } from "jotai"
import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/base-ui/alert-dialog"
import { Button } from "@/components/ui/base-ui/button"
import { writeConfigAtom } from "@/utils/atoms/config"
import { buildFreshDefaultConfig } from "@/utils/constants/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../../components/config-item"

export function ResetConfigItem() {
  const [open, setOpen] = useState(false)
  const setConfig = useSetAtom(writeConfigAtom)
  async function resetToDefaultConfig() {
    await setConfig(buildFreshDefaultConfig())
    setOpen(false)
  }

  return (
    <ConfigItem
      id="reset-config"
      title={i18n.t("options.preference.config.reset.title")}
      description={i18n.t("options.preference.config.reset.description")}
    >
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
          <IconRefresh />
          {i18n.t("options.preference.config.reset.dialog.trigger")}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {i18n.t("options.preference.config.reset.dialog.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {i18n.t("options.preference.config.reset.dialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {i18n.t("options.preference.config.reset.dialog.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={resetToDefaultConfig}>
              {i18n.t("options.preference.config.reset.dialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfigItem>
  )
}
