import type { APIProviderConfig } from "@/types/config/provider"
import { useEffect, useRef, useState } from "react"
import { browser } from "#imports"
import { Button } from "@/components/ui/base-ui/button"
import {
  clearCodexOAuthAuth,
  CODEX_OAUTH_DEVICE_URL,
  completeCodexDeviceAuthorization,
  getCodexOAuthAuth,
  startCodexDeviceAuthorization,
  type CodexOAuthAuth,
} from "@/utils/auth/codex-oauth"
import { i18n } from "@/utils/i18n"
import { ConnectionTestButton } from "./components/connection-button"

export function CodexOAuthField({ providerConfig }: { providerConfig: APIProviderConfig }) {
  const [auth, setAuth] = useState<CodexOAuthAuth | null>(null)
  const [userCode, setUserCode] = useState<string>()
  const [error, setError] = useState<string>()
  const [isPending, setIsPending] = useState(false)
  const abortControllerRef = useRef<AbortController | undefined>(undefined)

  useEffect(() => {
    void getCodexOAuthAuth().then(setAuth)
    return () => abortControllerRef.current?.abort()
  }, [])

  const signIn = async () => {
    abortControllerRef.current?.abort()
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    setError(undefined)
    setUserCode(undefined)
    setIsPending(true)

    try {
      const device = await startCodexDeviceAuthorization()
      setUserCode(device.userCode)
      await browser.tabs.create({ url: CODEX_OAUTH_DEVICE_URL })
      const nextAuth = await completeCodexDeviceAuthorization(device, {
        signal: abortController.signal,
      })
      setAuth(nextAuth)
      setUserCode(undefined)
    } catch (cause) {
      if (!abortController.signal.aborted) {
        setError(cause instanceof Error ? cause.message : String(cause))
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = undefined
        setIsPending(false)
      }
    }
  }

  const signOut = async () => {
    abortControllerRef.current?.abort()
    await clearCodexOAuthAuth()
    setAuth(null)
    setUserCode(undefined)
    setError(undefined)
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        {auth ? (
          <>
            <Button type="button" size="sm" variant="outline" onClick={signOut}>
              {i18n.t("options.apiProviders.codexOAuth.signOut")}
            </Button>
            <ConnectionTestButton providerConfig={providerConfig} />
          </>
        ) : (
          <Button type="button" size="sm" onClick={signIn} disabled={isPending}>
            {isPending
              ? i18n.t("options.apiProviders.codexOAuth.waiting")
              : i18n.t("options.apiProviders.codexOAuth.signIn")}
          </Button>
        )}
      </div>
      {auth && (
        <p className="text-sm text-muted-foreground">
          {auth.email
            ? i18n.t("options.apiProviders.codexOAuth.connectedAs", [auth.email])
            : i18n.t("options.apiProviders.codexOAuth.connected")}
        </p>
      )}
      {userCode && (
        <p className="text-sm text-muted-foreground">
          {i18n.t("options.apiProviders.codexOAuth.enterCode")}{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono font-semibold">{userCode}</code>
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
