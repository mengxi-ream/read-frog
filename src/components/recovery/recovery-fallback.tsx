import { i18n } from "#imports"
import { IconAlertCircle } from "@tabler/icons-react"
import { useAtomValue, useSetAtom } from "jotai"
import { useState } from "react"
import { toast } from "sonner"
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
import { useExportConfig } from "@/hooks/use-export-config"
import { configAtom, writeConfigAtom } from "@/utils/atoms/config"
import { CONFIG_SCHEMA_VERSION, DEFAULT_CONFIG } from "@/utils/constants/config"
import { Alert, AlertDescription, AlertTitle } from "../ui/base-ui/alert"

interface RecoveryFallbackProps {
  error: Error | null
  onRecovered: () => void
}

export function RecoveryFallback({ error, onRecovered }: RecoveryFallbackProps) {
  const config = useAtomValue(configAtom)
  const setConfig = useSetAtom(writeConfigAtom)
  const [isResetting, setIsResetting] = useState(false)

  const { mutate: exportConfig, isPending: isExporting } = useExportConfig({
    config,
    schemaVersion: CONFIG_SCHEMA_VERSION,
  })

  const handleResetConfig = async () => {
    setIsResetting(true)
    try {
      await setConfig(DEFAULT_CONFIG)
      toast.success(i18n.t("errorRecovery.resetSuccess"))
      onRecovered()
    }
    catch {
      toast.error(i18n.t("errorRecovery.resetFailed"))
    }
    finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="w-full min-h-full p-4 md:p-6">
      <div className="mx-auto max-w-xl rounded-xl border bg-card p-4 md:p-6 space-y-4">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{i18n.t("errorRecovery.title")}</h2>
          <p className="text-sm text-muted-foreground">{i18n.t("errorRecovery.description")}</p>
        </div>

        {error?.message && (
          <Alert variant="destructive">
            <IconAlertCircle />
            <AlertTitle>{i18n.t("errorRecovery.errorDetails")}</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{i18n.t("errorRecovery.backupTitle")}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => exportConfig(true)}
              disabled={isExporting || isResetting}
            >
              {i18n.t("errorRecovery.exportWithApiKeys")}
            </Button>
            <Button
              variant="outline"
              onClick={() => exportConfig(false)}
              disabled={isExporting || isResetting}
            >
              {i18n.t("errorRecovery.exportWithoutApiKeys")}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{i18n.t("errorRecovery.resetTitle")}</p>
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive" disabled={isExporting || isResetting} />}>
              {i18n.t("errorRecovery.resetAction")}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{i18n.t("errorRecovery.resetDialog.title")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {i18n.t("errorRecovery.resetDialog.description")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{i18n.t("errorRecovery.resetDialog.cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={handleResetConfig}
                  disabled={isResetting}
                >
                  {i18n.t("errorRecovery.resetDialog.confirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  )
}
