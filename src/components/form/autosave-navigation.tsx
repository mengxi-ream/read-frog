import type { ReactNode } from "react"
import type { AutosaveSession } from "./use-autosave"
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai"
import { useEffect, useId, useLayoutEffect } from "react"
import { useBlocker } from "react-router"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/base-ui/alert-dialog"
import { Button } from "@/components/ui/base-ui/button"
import { toastManager } from "@/components/ui/base-ui/toast"
import { i18n } from "@/utils/i18n"
import { AutosaveContext, useAutosaveState } from "./use-autosave"

export const activeAutosaveAtom = atom<AutosaveSession | null>(null)
const navigationBusyAtom = atom(false)
const navigationProceedingAtom = atom(false)
const blockedNavigationAtom = atom<{
  session: AutosaveSession
  proceed: () => void | Promise<void>
  resolve: (proceeded: boolean) => void
} | null>(null)

export const requestEditorNavigationAtom = atom(
  null,
  async (get, set, proceed: () => void | Promise<void>) => {
    if (get(navigationProceedingAtom)) {
      await proceed()
      return true
    }
    if (get(navigationBusyAtom)) return false
    set(navigationBusyAtom, true)
    const run = async () => {
      set(navigationProceedingAtom, true)
      try {
        await proceed()
      } finally {
        set(navigationProceedingAtom, false)
      }
    }
    try {
      const session = get(activeAutosaveAtom)
      if (session) {
        const state = session.getSnapshot()
        if (state.dirty || state.busy || state.composing) {
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
          const result = await session.flush()
          if (result === "invalid" || result === "failed") {
            return await new Promise<boolean>((resolve) => {
              set(blockedNavigationAtom, { session, proceed: run, resolve })
            })
          }
        }
      }
      await run()
      return true
    } finally {
      set(navigationBusyAtom, false)
    }
  },
)

export function AutosaveBoundary({
  session,
  children,
}: {
  session: AutosaveSession
  children: ReactNode
}) {
  const setActive = useSetAtom(activeAutosaveAtom)
  useLayoutEffect(() => {
    setActive(session)
    return () => setActive((current) => (current === session ? null : current))
  }, [session, setActive])
  const state = useAutosaveState(session)
  const toastId = useId()
  useEffect(() => {
    const error = state.error
    // Validation belongs beside its field. Persistence errors use the existing
    // toast surface so editing never inserts a banner or shifts the form.
    if (error !== "failed" && error !== "deleted") return undefined
    toastManager.add({
      id: toastId,
      type: "error",
      title: i18n.t(`options.autosave.${error}`),
      ...(error === "failed"
        ? {
            actionProps: {
              children: i18n.t("options.autosave.retry"),
              onClick: () => {
                void session.flush()
              },
            },
          }
        : {}),
    })
    return () => {
      toastManager.close(toastId)
    }
  }, [session, state.error, toastId])
  return <AutosaveContext value={session}>{children}</AutosaveContext>
}

const idle = {
  subscribe: () => () => {},
  getSnapshot: () => idleState,
}
const idleState = { dirty: false, busy: false, composing: false, error: null }

/** Mounted once under the data router, including when the active editor changes. */
export function AutosaveNavigation() {
  const session = useAtomValue(activeAutosaveAtom)
  const state = useAutosaveState(session ?? idle)
  const [blocked, setBlocked] = useAtom(blockedNavigationAtom)
  const requestNavigation = useSetAtom(requestEditorNavigationAtom)
  const shouldBlock = state.dirty || state.busy || state.composing
  const blocker = useBlocker(shouldBlock)

  useEffect(() => {
    if (blocker.state !== "blocked") return undefined
    let cancelled = false
    void requestNavigation(() => {
      if (!cancelled) blocker.proceed()
    }).then((proceeded) => {
      if (!proceeded && !cancelled) blocker.reset()
    })
    return () => {
      cancelled = true
    }
  }, [blocker, requestNavigation])

  useEffect(() => {
    if (!shouldBlock) return undefined
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [shouldBlock])

  const stay = () => {
    blocked?.resolve(false)
    setBlocked(null)
  }
  return (
    <AlertDialog
      open={!!blocked}
      onOpenChange={(open) => {
        if (!open) stay()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{i18n.t("options.autosave.leaveTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {i18n.t("options.autosave.leaveDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button type="button" variant="outline" onClick={stay}>
            {i18n.t("options.autosave.keepEditing")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={async () => {
              if (!blocked) return
              await blocked.session.discard()
              setBlocked(null)
              await blocked.proceed()
              blocked.resolve(true)
            }}
          >
            {i18n.t("options.autosave.discard")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
