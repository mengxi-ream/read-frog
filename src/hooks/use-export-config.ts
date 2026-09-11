import type { Config } from "@/types/config/config"
import { useMutation } from "@tanstack/react-query"
import { kebabCase } from "case-anything"
import { saveAs } from "file-saver"
import { toastManager } from "@/components/ui/base-ui/toast"
import { getObjectWithoutAPIKeys } from "@/utils/config/api"
import { APP_NAME } from "@/utils/constants/app"
import { buildGlossaryDocument } from "@/utils/glossary/sync/document"
import { readLocalGlossary } from "@/utils/glossary/sync/local-store"
import { i18n } from "@/utils/i18n"
import { logger } from "@/utils/logger"

interface UseExportConfigOptions {
  config: Config
  schemaVersion: number
  /**
   * Whether to put the glossaries in the file alongside the settings.
   *
   * True wherever the export means "everything I have right now", because the
   * glossaries are the only thing in the product the user typed and cannot get
   * back any other way. False when the export is of a PAST config — a stored
   * backup — where attaching today's glossaries would describe a moment that
   * never existed.
   */
  includeGlossary?: boolean
}

export function useExportConfig({
  config,
  schemaVersion,
  includeGlossary = true,
}: UseExportConfigOptions) {
  return useMutation({
    mutationFn: async (includeApiKeys: boolean) => {
      let exportConfig = config

      if (!includeApiKeys) {
        exportConfig = getObjectWithoutAPIKeys(config)
      }

      // Best effort, and deliberately so: this hook is also what the recovery
      // screen offers when the extension is already broken, and a database that
      // will not open must not be able to stop the settings from getting out.
      //
      // Best effort is not the same as silent, though. The file is the user's
      // backup of the one thing in the product they cannot get back any other
      // way, so a missing glossary is said out loud in the toast rather than
      // logged to a console nobody is reading.
      let glossary: ReturnType<typeof buildGlossaryDocument> | undefined
      let glossaryFailed = false
      if (includeGlossary) {
        try {
          glossary = buildGlossaryDocument(await readLocalGlossary())
        } catch (error) {
          glossaryFailed = true
          logger.error("Could not read the glossary for export", error)
        }
      }

      const json = JSON.stringify(
        {
          config: exportConfig,
          schemaVersion,
          // Its own top-level key, in the same shape the Drive sync writes, so
          // one reader handles both routes and a file from either can be
          // imported by either. Older builds simply ignore it.
          ...(glossary ? { glossary } : {}),
        },
        null,
        2,
      )
      const blob = new Blob([json], { type: "text/json" })
      saveAs(blob, `${kebabCase(APP_NAME)}-config-v${schemaVersion}.json`)
      return { glossaryFailed }
    },
    onSuccess: ({ glossaryFailed }) => {
      toastManager.add({
        type: glossaryFailed ? "warning" : "success",
        title: i18n.t("options.preference.config.manualSync.exportSuccess"),
        description: glossaryFailed
          ? i18n.t("options.preference.config.manualSync.exportGlossaryFailed")
          : undefined,
      })
    },
  })
}
