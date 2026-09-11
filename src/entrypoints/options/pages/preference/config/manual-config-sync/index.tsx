import { Icon } from "@iconify/react"
import { useMutation } from "@tanstack/react-query"
import { useAtomValue, useSetAtom } from "jotai"
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
import { Input } from "@/components/ui/base-ui/input"
import { Label } from "@/components/ui/base-ui/label"
import { toastManager } from "@/components/ui/base-ui/toast"
import { useExportConfig } from "@/hooks/use-export-config"
import { configAtom, writeConfigAtom } from "@/utils/atoms/config"
import { addBackup } from "@/utils/backup/storage"
import { migrateConfig } from "@/utils/config/migration"
import { EXTENSION_VERSION } from "@/utils/constants/app"
import { CONFIG_SCHEMA_VERSION } from "@/utils/constants/config"
import { MAX_GLOSSARIES, MAX_GLOSSARY_TERMS } from "@/utils/constants/glossary"
import { readGlossaryDocument } from "@/utils/glossary/sync/document"
import {
  checkGlossaryCaps,
  replaceGlossary,
  restoreUndoSnapshot,
} from "@/utils/glossary/sync/local-store"
import { i18n } from "@/utils/i18n"
import { queryClient } from "@/utils/tanstack-query"
import { ConfigItem } from "../../../../components/config-item"
import { ViewConfig } from "../../../../components/view-config"
import { useGlossaryInvalidation } from "../../../advanced/glossary/use-glossary"

export function ManualConfigSyncConfigItems() {
  const config = useAtomValue(configAtom)
  return (
    // The two rows read as one block: the second carries no title of its own.
    <div className="flex flex-col gap-4">
      <ConfigItem
        id="manual-config-sync"
        title={i18n.t("options.preference.config.manualSync.title")}
        description={i18n.t("options.preference.config.manualSync.description")}
      >
        <div className="flex gap-2">
          <ImportConfig />
          <ExportConfig />
        </div>
      </ConfigItem>
      <ConfigItem description={i18n.t("options.preference.config.viewConfig.description")}>
        <ViewConfig config={config} size="sm" />
      </ConfigItem>
    </div>
  )
}

function ImportConfig() {
  const currentConfig = useAtomValue(configAtom)
  const setConfig = useSetAtom(writeConfigAtom)
  const invalidateGlossary = useGlossaryInvalidation()

  const { mutate: importConfig, isPending: isImporting } = useMutation({
    mutationFn: async (file: File) => {
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (event) => {
          const result = event.target?.result
          if (typeof result === "string") {
            resolve(result)
          } else {
            reject(new Error("Invalid file content"))
          }
        }
        reader.onerror = () =>
          reject(new Error(i18n.t("options.preference.config.manualSync.importError")))
        reader.readAsText(file)
      })

      const parsed = JSON.parse(fileContent) as {
        schemaVersion?: unknown
        config?: unknown
        glossary?: unknown
      }

      const importConfigSchemaVersion = parsed.schemaVersion
      if (
        typeof importConfigSchemaVersion !== "number" ||
        !Number.isInteger(importConfigSchemaVersion)
      ) {
        throw new TypeError("Invalid config schemaVersion")
      }

      if (parsed.config === undefined) {
        throw new TypeError("Missing config payload")
      }

      const newConfig = await migrateConfig(parsed.config, importConfigSchemaVersion)

      // Read BEFORE anything is written: a file carrying a glossary this build
      // cannot read, or one over the cap, must not land a half import that
      // replaces the settings and leaves the terms behind.
      const glossary = parsed.glossary === undefined ? null : readGlossaryDocument(parsed.glossary)
      if (glossary && !glossary.ok) {
        throw new Error(
          glossary.reason === "version-too-new"
            ? i18n.t("options.preference.config.manualSync.glossaryVersionTooNew")
            : i18n.t("options.preference.config.manualSync.glossaryMalformed"),
        )
      }

      // The cap belongs up here with the other two refusals, not inside the
      // replace below: everything after this line writes. Asking afterwards
      // swapped the settings, left the terms behind, and said "Nothing was
      // changed" — the one half import all three of these checks exist to stop.
      const overflow = glossary?.ok ? checkGlossaryCaps(glossary.document) : null
      if (overflow) {
        throw new Error(
          i18n.t("options.preference.config.manualSync.glossaryCapExceeded", [
            String(overflow.overflowBy),
            String(overflow.reason === "termCapExceeded" ? MAX_GLOSSARY_TERMS : MAX_GLOSSARIES),
          ]),
        )
      }

      await addBackup(currentConfig, EXTENSION_VERSION)
      await setConfig(newConfig)

      if (!glossary?.ok) return { glossaryTerms: null }

      const replaced = await replaceGlossary(glossary.document)
      if (!replaced.ok) {
        throw new Error(
          i18n.t("options.preference.config.manualSync.glossaryCapExceeded", [
            String(replaced.overflowBy),
            String(replaced.reason === "termCapExceeded" ? MAX_GLOSSARY_TERMS : MAX_GLOSSARIES),
          ]),
        )
      }
      return { glossaryTerms: replaced.terms }
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["config-backups"] })
      void invalidateGlossary()
      toastManager.add({
        type: "success",
        title: i18n.t("options.preference.config.manualSync.importSuccess"),
        description:
          result.glossaryTerms === null
            ? undefined
            : i18n.t("options.preference.config.manualSync.glossaryImported", [
                String(result.glossaryTerms),
              ]),
        // The terms it replaced are still in the undo slot, so one click puts
        // them back — the settings keep their own history in the backup list.
        actionProps:
          result.glossaryTerms === null
            ? undefined
            : {
                children: i18n.t("options.preference.config.manualSync.glossaryUndo"),
                onClick: () => {
                  void (async () => {
                    // The sync base still describes the last real agreement with
                    // the cloud, and an import never touched it.
                    // Refused when the slot has since been taken by a sync.
                    // Say so rather than leaving the click to do nothing.
                    if (!(await restoreUndoSnapshot({ source: "import", clearBase: false }))) {
                      toastManager.add({
                        type: "error",
                        title: i18n.t(
                          "options.preference.config.manualSync.glossaryUndoUnavailable",
                        ),
                      })
                      return
                    }
                    await invalidateGlossary()
                    toastManager.add({
                      type: "success",
                      title: i18n.t("options.preference.config.manualSync.glossaryUndone"),
                    })
                  })()
                },
              },
      })
    },
    onError: (error) => {
      toastManager.add({
        type: "error",
        title: i18n.t("options.preference.config.manualSync.importError"),
        description: error instanceof Error ? error.message : undefined,
      })
    },
  })

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      importConfig(file)
    }
    e.target.value = ""
    e.target.files = null
  }

  return (
    <Button variant="outline" size="sm" className="p-0" disabled={isImporting}>
      {/* The label fills the button so the whole thing opens the file picker; it inherits the
          button's own font size instead of `Label`'s fixed `text-sm`. */}
      <Label htmlFor="import-config-file" className="w-full gap-1 px-2.5 text-[length:inherit]">
        <Icon icon="tabler:file-import" />
        {i18n.t("options.preference.config.manualSync.import")}
      </Label>
      <Input
        type="file"
        id="import-config-file"
        className="hidden"
        accept=".json"
        onChange={handleImportConfig}
      />
    </Button>
  )
}

function ExportConfig() {
  const [open, setOpen] = useState(false)
  const config = useAtomValue(configAtom)

  const { mutate: exportConfig, isPending: isExporting } = useExportConfig({
    config,
    schemaVersion: CONFIG_SCHEMA_VERSION,
  })

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="outline" size="sm" disabled={isExporting} />}>
        <Icon icon="tabler:file-export" />
        {i18n.t("options.preference.config.manualSync.export")}
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {i18n.t("options.preference.config.manualSync.exportOptions.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {i18n.t("options.preference.config.manualSync.exportOptions.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex justify-between!">
          <AlertDialogCancel>
            {i18n.t("options.preference.config.manualSync.exportOptions.cancel")}
          </AlertDialogCancel>
          <div className="flex gap-2">
            <AlertDialogAction
              variant="secondary"
              onClick={() => exportConfig(true, { onSettled: () => setOpen(false) })}
              disabled={isExporting}
            >
              {i18n.t("options.preference.config.manualSync.exportOptions.includeAPIKeys")}
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => exportConfig(false, { onSettled: () => setOpen(false) })}
              disabled={isExporting}
            >
              {i18n.t("options.preference.config.manualSync.exportOptions.excludeAPIKeys")}
            </AlertDialogAction>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
