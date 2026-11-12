import { useMutation } from "@tanstack/react-query"
import { kebabCase } from "case-anything"
import { saveAs } from "file-saver"
import { toastManager } from "@/components/ui/base-ui/toast"
import { APP_NAME } from "@/utils/constants/app"
import { buildDiagnosticsReport } from "@/utils/diagnostics/report"
import { i18n } from "@/utils/i18n"
import { createLogger } from "@/utils/logging/logger"
import { sendMessage } from "@/utils/message"

const log = createLogger("use-export-diagnostics")

async function getDiagnosticsReport() {
  try {
    // The background owns the log, including the records it has not written yet.
    return await sendMessage("getDiagnosticsReport", undefined)
  } catch (error) {
    // A background that cannot answer is worth a report of its own: build it here.
    log.warn("The background could not build the diagnostics report", { error })
    return buildDiagnosticsReport()
  }
}

/** Saves a diagnostics file for the user to attach to a bug report; nothing is sent anywhere. */
export function useExportDiagnostics() {
  return useMutation({
    mutationFn: async () => {
      const report = await getDiagnosticsReport()
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" })
      const date = report.generatedAt.slice(0, 10)
      saveAs(blob, `${kebabCase(APP_NAME)}-diagnostics-${date}.json`)
    },
    onSuccess: () => {
      toastManager.add({
        type: "success",
        title: i18n.t("options.helpAndCommunity.diagnostics.exportSuccess"),
      })
    },
    onError: (error) => {
      log.error("Failed to export diagnostics", { error })
      toastManager.add({
        type: "error",
        title: i18n.t("options.helpAndCommunity.diagnostics.exportFailed"),
      })
    },
  })
}
