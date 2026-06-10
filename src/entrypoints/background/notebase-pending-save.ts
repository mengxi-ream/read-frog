import type { NotebaseCreateInput, NotebaseGetSchemaOutput } from "@read-frog/api-contract"
import type { Config } from "@/types/config/config"
import type { PendingNotebaseSave, PendingNotebaseSaveActionStatus } from "@/utils/notebase-pending-save"
import { ORPCError } from "@orpc/client"
import { AUTH_BASE_PATH, AUTH_COOKIE_PATTERNS } from "@read-frog/definitions"
import { browser } from "#imports"
import { env } from "@/env"
import { getLocalConfig, setLocalConfig } from "@/utils/config/storage"
import { logger } from "@/utils/logger"
import { isORPCUnauthorizedError, isORPCValidationError } from "@/utils/notebase"
import {
  applyPendingNotebaseConnectionToConfig,
  buildNotebaseCreateInputFromPending,
  clearPendingNotebaseSave,
  doesSchemaMatchPendingColumns,
  getNotebaseDetailUrl,
  getPendingNotebaseSave,
  isPendingNotebaseSaveExpired,
  validatePendingNotebaseSaveAction,
} from "@/utils/notebase-pending-save"
import { backgroundOrpcClient } from "@/utils/orpc/background-client"

interface PendingNotebaseSaveProcessorDeps {
  getPending: () => Promise<PendingNotebaseSave | null>
  clearPending: () => Promise<void>
  getConfig: () => Promise<Config | null>
  setConfig: (config: Config) => Promise<void>
  hasAuthenticatedSession: () => Promise<boolean>
  createNotebase: (input: NotebaseCreateInput) => Promise<unknown>
  getSchema: (id: string) => Promise<NotebaseGetSchemaOutput>
  openNotebasePage: (notebaseId: string) => Promise<void>
  now: () => number
  log: Pick<typeof logger, "info" | "warn" | "error">
}

function isORPCForbiddenError(error: unknown) {
  return error instanceof ORPCError && (error.code === "FORBIDDEN" || error.status === 403)
}

function isAuthCookieChange(cookie: { domain?: string, name: string }) {
  if (!cookie.domain) {
    return false
  }

  const cookieDomain = cookie.domain
  return env.WXT_AUTH_COOKIE_DOMAINS.some((domain: string) => cookieDomain.includes(domain))
    && AUTH_COOKIE_PATTERNS.some(name => cookie.name.includes(name))
}

async function hasAuthenticatedSession() {
  try {
    // TODO: Extract a background-only Better Auth client if background auth calls grow.
    // Do not reuse the React authClient here because it proxies through backgroundFetch.
    const response = await fetch(`${env.WXT_API_URL}${AUTH_BASE_PATH}/get-session`, {
      credentials: "include",
      cache: "no-store",
    })

    if (!response.ok) {
      return false
    }

    const body = await response.json().catch(() => null) as { user?: unknown } | null
    return !!body?.user
  }
  catch (error) {
    logger.warn("[NotebasePendingSave] Failed to probe auth session", error)
    return false
  }
}

function shouldClearCreateError(error: unknown) {
  return isORPCForbiddenError(error) || isORPCValidationError(error)
}

async function completePendingSave(
  deps: PendingNotebaseSaveProcessorDeps,
  pending: PendingNotebaseSave,
) {
  const config = await deps.getConfig()
  if (!config) {
    deps.log.warn("[NotebasePendingSave] Config unavailable after create; keeping pending save")
    return false
  }

  const applied = applyPendingNotebaseConnectionToConfig(config, pending)
  if (applied.status !== "valid" || !applied.config) {
    await deps.clearPending()
    deps.log.info("[NotebasePendingSave] Cleared pending save before writing connection", {
      status: applied.status,
      pendingId: pending.id,
    })
    return false
  }

  await deps.setConfig(applied.config)
  await deps.clearPending()
  deps.log.info("[NotebasePendingSave] Pending save completed", {
    pendingId: pending.id,
    actionId: pending.actionId,
    notebaseId: pending.notebaseId,
  })

  try {
    await deps.openNotebasePage(pending.notebaseId)
  }
  catch (error) {
    deps.log.warn("[NotebasePendingSave] Failed to open Notebase detail page", error)
  }

  return true
}

async function tryDuplicateCreateRecovery(
  deps: PendingNotebaseSaveProcessorDeps,
  pending: PendingNotebaseSave,
) {
  try {
    const schema = await deps.getSchema(pending.notebaseId)
    if (!doesSchemaMatchPendingColumns(schema, pending)) {
      deps.log.warn("[NotebasePendingSave] Duplicate recovery schema did not match pending columns", {
        pendingId: pending.id,
        notebaseId: pending.notebaseId,
      })
      return false
    }

    return await completePendingSave(deps, pending)
  }
  catch (error) {
    deps.log.warn("[NotebasePendingSave] Duplicate recovery failed", error)
    return false
  }
}

async function getPendingStatus(
  deps: PendingNotebaseSaveProcessorDeps,
  pending: PendingNotebaseSave,
): Promise<PendingNotebaseSaveActionStatus | "expired" | "missing_config"> {
  if (isPendingNotebaseSaveExpired(pending, deps.now())) {
    return "expired"
  }

  const config = await deps.getConfig()
  if (!config) {
    return "missing_config"
  }

  return validatePendingNotebaseSaveAction(config, pending).status
}

export function createNotebasePendingSaveProcessor(deps: PendingNotebaseSaveProcessorDeps) {
  let isProcessing = false

  return async function processPendingNotebaseSave(reason: string) {
    if (isProcessing) {
      deps.log.info("[NotebasePendingSave] Skipping duplicate processor run", { reason })
      return
    }

    isProcessing = true
    try {
      const pending = await deps.getPending()
      if (!pending) {
        return
      }

      const pendingStatus = await getPendingStatus(deps, pending)
      if (pendingStatus === "missing_config") {
        deps.log.warn("[NotebasePendingSave] Config unavailable; keeping pending save", {
          pendingId: pending.id,
        })
        return
      }

      if (pendingStatus !== "valid") {
        await deps.clearPending()
        deps.log.info("[NotebasePendingSave] Cleared invalid pending save", {
          pendingId: pending.id,
          status: pendingStatus,
        })
        return
      }

      if (!await deps.hasAuthenticatedSession()) {
        deps.log.info("[NotebasePendingSave] User is not authenticated; keeping pending save", {
          pendingId: pending.id,
        })
        return
      }

      try {
        await deps.createNotebase(buildNotebaseCreateInputFromPending(pending))
        await completePendingSave(deps, pending)
      }
      catch (error) {
        if (isORPCUnauthorizedError(error)) {
          deps.log.info("[NotebasePendingSave] Auth disappeared during create; keeping pending save", {
            pendingId: pending.id,
          })
          return
        }

        if (shouldClearCreateError(error)) {
          await deps.clearPending()
          deps.log.warn("[NotebasePendingSave] Cleared pending save after unrecoverable create error", error)
          return
        }

        if (await tryDuplicateCreateRecovery(deps, pending)) {
          return
        }

        deps.log.warn("[NotebasePendingSave] Create failed; keeping pending save until expiry", error)
      }
    }
    catch (error) {
      deps.log.error("[NotebasePendingSave] Processor failed", error)
    }
    finally {
      isProcessing = false
    }
  }
}

export function setupNotebasePendingSaveProcessor() {
  const processPendingNotebaseSave = createNotebasePendingSaveProcessor({
    getPending: getPendingNotebaseSave,
    clearPending: clearPendingNotebaseSave,
    getConfig: getLocalConfig,
    setConfig: setLocalConfig,
    hasAuthenticatedSession,
    createNotebase: input => backgroundOrpcClient.notebase.create(input),
    getSchema: id => backgroundOrpcClient.notebase.getSchema({ id }),
    openNotebasePage: async (notebaseId) => {
      await browser.tabs.create({
        active: true,
        url: getNotebaseDetailUrl(notebaseId),
      })
    },
    now: () => Date.now(),
    log: logger,
  })

  void processPendingNotebaseSave("startup")

  if (browser.cookies?.onChanged) {
    browser.cookies.onChanged.addListener((changeInfo) => {
      if (isAuthCookieChange(changeInfo.cookie)) {
        void processPendingNotebaseSave("auth-cookie-change")
      }
    })
  }
}
