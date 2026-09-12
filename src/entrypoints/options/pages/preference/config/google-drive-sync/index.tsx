import { Icon } from "@iconify/react"
import { useAtomValue, useSetAtom } from "jotai"
import { Activity, useRef, useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { toastManager } from "@/components/ui/base-ui/toast"
import { useGoogleDriveAuth } from "@/hooks/use-google-drive-auth"
import { resolutionsAtom, unresolvedConfigsAtom } from "@/utils/atoms/google-drive-sync"
import { lastSyncTimeAtom } from "@/utils/atoms/last-sync-time"
import { clearAccessToken, getGoogleUserInfo, getValidAccessToken } from "@/utils/google-drive/auth"
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

  /**
   * The account the current Sync click was made under.
   *
   * A ref because the glossary half can run long after the click, once the
   * config conflict dialog closes, and it has to be held to the account the
   * user was on when they pressed the button rather than to whoever is signed
   * in by then.
   */
  const clickAccount = useRef<string | undefined>(undefined)

  // Always leaves `isSyncing` false, so a fault in either half cannot strand the
  // button disabled until the page is reloaded.
  const runGlossarySync = async (options?: { token?: string; expectedEmail?: string }) => {
    setIsSyncing(true)
    try {
      await glossarySync.start(options)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleSync = async () => {
    setIsSyncing(true)

    // Taken once, before either half. `getValidAccessToken` re-authenticates
    // inside a 60s buffer and asks which account to use, so two halves each
    // fetching their own can end up bound to two different Google accounts.
    //
    // Failing here ends the whole sync rather than falling through: neither half
    // can do anything without a token, and letting them try would put the
    // account chooser in front of the user a second time for the same click.
    let accessToken: string
    let accountEmail: string
    try {
      accessToken = await getValidAccessToken()
      accountEmail = (await getGoogleUserInfo(accessToken)).email
      clickAccount.current = accountEmail
    } catch (error) {
      logger.error("Google Drive sync could not get a token", error)
      toastManager.add({
        type: "error",
        title: i18n.t("options.preference.config.googleDrive.syncError"),
      })
      setIsSyncing(false)
      return
    }

    // Passed down, not just fetched: both halves have to reach the same Drive,
    // and each resolving its own token is what let one click write the config
    // to the account the user started with and the glossary to the one another
    // tab switched to.
    const result = await syncConfig(accessToken)

    if (result.status === "unresolved") {
      // The config half needs the user, and its dialog is now up. The glossary
      // half waits for it: opening a second alert dialog on top leaves two
      // modals with no stated order, and dismissing the wrong one cancels the
      // glossary sync outright. `handleDialogClose` starts it once this closes.
      setUnresolvedData(result.data)
      setIsOpen(true)
      setIsSyncing(false)
      return
    }

    if (result.status === "success") {
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
    await runGlossarySync({ token: accessToken, expectedEmail: accountEmail })
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
    // Deferred from `handleSync` so the two dialogs never overlap. It runs even
    // when the config half was cancelled: the two files fail for their own
    // reasons, and one being abandoned is not a reason to skip the other.
    // No token: this dialog can sit open for minutes and the one taken for that
    // click may well have expired. The ACCOUNT still carries over, though —
    // without it a fresh token would silently bind this half to whoever another
    // tab has since switched to, and the config would already have gone to the
    // account the click started on.
    void runGlossarySync({ expectedEmail: clickAccount.current })
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
