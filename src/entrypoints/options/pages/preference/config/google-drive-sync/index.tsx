import { Icon } from "@iconify/react"
import { useAtomValue, useSetAtom } from "jotai"
import { Activity, useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { toastManager } from "@/components/ui/base-ui/toast"
import { useGoogleDriveAuth } from "@/hooks/use-google-drive-auth"
import { resolutionsAtom, unresolvedConfigsAtom } from "@/utils/atoms/google-drive-sync"
import { lastSyncTimeAtom } from "@/utils/atoms/last-sync-time"
import { clearAccessToken, getValidAccessToken } from "@/utils/google-drive/auth"
import { syncConfig } from "@/utils/google-drive/sync"
import { i18n } from "@/utils/i18n"
import { logger } from "@/utils/logger"
import { ConfigItem } from "../../../../components/config-item"
import { GlossarySyncReviewDialog } from "./components/glossary-review-dialog"
import { UnresolvedDialog } from "./components/unresolved-dialog"
import { useGlossarySync } from "./use-glossary-sync"

export function GoogleDriveSyncConfigItem() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const {
    query: { data: authData },
    invalidate: invalidateAuthData,
  } = useGoogleDriveAuth()
  const setUnresolvedData = useSetAtom(unresolvedConfigsAtom)
  const setResolutions = useSetAtom(resolutionsAtom)
  const lastSyncTime = useAtomValue(lastSyncTimeAtom)
  const glossarySync = useGlossarySync()

  const handleSync = async () => {
    setIsSyncing(true)

    // Taken once, before either half. `getValidAccessToken` re-authenticates
    // inside a 60s buffer and asks which account to use, so two halves each
    // fetching their own can end up bound to two different Google accounts.
    //
    // Failing here ends the whole sync rather than falling through: neither half
    // can do anything without a token, and letting them try would put the
    // account chooser in front of the user a second time for the same click.
    try {
      await getValidAccessToken()
    } catch (error) {
      logger.error("Google Drive sync could not get a token", error)
      toastManager.add({
        type: "error",
        title: i18n.t("options.preference.config.googleDrive.syncError"),
      })
      setIsSyncing(false)
      return
    }

    const result = await syncConfig()

    if (result.status === "unresolved") {
      setUnresolvedData(result.data)
      setIsOpen(true)
    } else if (result.status === "success") {
      const messages = {
        uploaded: i18n.t("options.preference.config.googleDrive.syncSuccess.uploaded"),
        downloaded: i18n.t("options.preference.config.googleDrive.syncSuccess.downloaded"),
        "same-changes": i18n.t("options.preference.config.googleDrive.syncSuccess.sameChanges"),
        "no-change": i18n.t("options.preference.config.googleDrive.syncSuccess.noChange"),
      } as const
      toastManager.add({ type: "success", title: messages[result.action] })
    } else {
      logger.error("Google Drive sync error", result.error)
      toastManager.add({
        type: "error",
        title: i18n.t("options.preference.config.googleDrive.syncError"),
        description: result.error.message,
      })
    }

    // The glossary lives in its own Drive file and fails for its own reasons, so
    // it runs whatever the config half did and says so separately.
    await glossarySync.start()

    setIsSyncing(false)
  }

  const handleLogout = async () => {
    await clearAccessToken()
    void invalidateAuthData()
    toastManager.add({
      type: "success",
      title: i18n.t("options.preference.config.googleDrive.logoutSuccess"),
    })
  }

  const handleDialogClose = (success: boolean) => {
    setIsOpen(false)
    setResolutions({})
    if (success) {
      toastManager.add({
        type: "success",
        title: i18n.t("options.preference.config.googleDrive.syncSuccess.unresolved"),
      })
    } else {
      toastManager.add({
        type: "error",
        title: i18n.t("options.preference.config.googleDrive.syncError"),
      })
    }
  }

  const formatLastSyncTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString()
  }

  return (
    <>
      <ConfigItem
        id="google-drive-sync"
        title={i18n.t("options.preference.config.googleDrive.title")}
        description={
          <div className="flex flex-col gap-2">
            {i18n.t("options.preference.config.googleDrive.description")}
            <Activity mode={authData?.isAuthenticated ? "visible" : "hidden"}>
              <div className="flex items-center gap-1.5">
                {authData?.userInfo?.picture && (
                  <img
                    src={authData.userInfo.picture}
                    alt="Google Account"
                    className="size-4.5 rounded-full border"
                  />
                )}
                <span className="text-xs">{authData?.userInfo?.email}</span>
              </div>
            </Activity>
          </div>
        }
      >
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex gap-2">
            <Activity mode={authData?.isAuthenticated ? "visible" : "hidden"}>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                {i18n.t("options.preference.config.googleDrive.logout")}
              </Button>
            </Activity>
            <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing}>
              <Icon icon="logos:google-drive" />
              {isSyncing
                ? i18n.t("options.preference.config.googleDrive.syncing")
                : i18n.t("options.preference.config.googleDrive.sync")}
            </Button>
          </div>
          <Activity mode={lastSyncTime ? "visible" : "hidden"}>
            <span className="text-xs whitespace-nowrap text-muted-foreground">
              {i18n.t("options.preference.config.googleDrive.lastSyncTime")}:{" "}
              {lastSyncTime && formatLastSyncTime(lastSyncTime)}
            </span>
          </Activity>
        </div>
      </ConfigItem>

      <UnresolvedDialog
        open={isOpen}
        onResolved={() => handleDialogClose(true)}
        onCancelled={() => handleDialogClose(false)}
      />

      <GlossarySyncReviewDialog
        plan={glossarySync.pendingPlan}
        onCancel={glossarySync.cancel}
        onConfirm={(resolutions) => void glossarySync.confirm(resolutions)}
      />
    </>
  )
}
