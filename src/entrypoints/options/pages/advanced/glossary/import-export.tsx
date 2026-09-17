import { Icon } from "@iconify/react"
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
} from "@/components/ui/base-ui/alert-dialog"
import { Button } from "@/components/ui/base-ui/button"
import { Label } from "@/components/ui/base-ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { toastManager } from "@/components/ui/base-ui/toast"
import { decodeGlossaryCsv, parseGlossaryCsv, UTF8_BOM } from "@/utils/glossary/csv"
import { exportGlossaryCsv } from "@/utils/glossary/repository"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { useGlossaryTerms, useImportGlossary } from "./use-glossary"

const IMPORT_INPUT_ID = "glossary-import-file"

const IMPORT_MODES = ["merge", "replace"] as const
type ImportMode = (typeof IMPORT_MODES)[number]

const MODE_LABEL_KEY = {
  merge: "options.advanced.glossary.importModeMerge",
  replace: "options.advanced.glossary.importModeReplace",
} as const satisfies Record<ImportMode, string>

export function GlossaryImportExport({
  glossaryId,
  glossaryName,
}: {
  glossaryId: string
  glossaryName: string
}) {
  const [mode, setMode] = useState<ImportMode>("merge")
  const { mutateAsync: importRows, isPending } = useImportGlossary(glossaryId)
  // `isSuccess`, not just the data: an unsettled or failed query would render
  // "All 0 terms will be deleted" on the one screen where that number IS the
  // safety information, which understates the damage and reads as reassuring.
  const { data: terms = [], isSuccess: termCountKnown } = useGlossaryTerms(glossaryId)
  // Held between picking the file and confirming the replace. Replace deletes
  // text the user typed, so it goes behind the same kind of confirm as
  // `GlossaryDeleteAllItem` rather than firing straight off the file picker.
  const [pendingReplaceFile, setPendingReplaceFile] = useState<File | null>(null)

  const handleImport = async (file: File) => {
    // `arrayBuffer`, not `text`: the latter is UTF-8 only and turns a file Excel
    // saved in the system code page into replacement characters rather than an
    // error. `decodeGlossaryCsv` tries strict UTF-8 first and can tell.
    const parsed = parseGlossaryCsv(decodeGlossaryCsv(await file.arrayBuffer()))
    // Not one of ours, so its columns are unknown and its rows cannot be placed.
    // The message names the format rather than saying the file is bad, because
    // the way out is to export a glossary and look at it.
    if (!parsed.ok) {
      toastManager.add({
        type: "error",
        title: i18n.t("options.advanced.glossary.importMissingHeader"),
        description: "source,target,targetLanguage,caseSensitive",
      })
      return
    }

    const { rows, skipped } = parsed
    if (rows.length === 0) {
      toastManager.add({ type: "error", title: i18n.t("options.advanced.glossary.importEmpty") })
      return
    }

    const result = await importRows({ rows, mode })

    // Refused whole rather than partially applied — over the cap, or with not a
    // single usable row. Truncating (or, under replace, emptying the list and
    // inserting nothing) would leave the user unable to see what is missing.
    if (!result.ok) {
      toastManager.add({
        type: "error",
        title:
          result.reason === "no-valid-rows"
            ? i18n.t("options.advanced.glossary.importNoValidRows")
            : i18n.t("options.advanced.glossary.importOverflow", [String(result.overflowBy ?? 0)]),
      })
      return
    }

    toastManager.add({
      type: "success",
      title: i18n.t("options.advanced.glossary.importSuccess", [
        String(result.added),
        String(result.updated),
      ]),
      description:
        skipped.length > 0 || result.duplicatesInFile > 0
          ? i18n.t("options.advanced.glossary.importSkipped", [
              String(skipped.length),
              String(result.duplicatesInFile),
            ])
          : undefined,
    })
  }

  const handleExport = async () => {
    const csv = await exportGlossaryCsv(glossaryId)
    // The BOM is what makes the file open as UTF-8 in Excel instead of as
    // mojibake; the parser strips it back off on the way in.
    const url = URL.createObjectURL(new Blob([UTF8_BOM + csv], { type: "text/csv;charset=utf-8" }))
    const anchor = document.createElement("a")
    anchor.href = url
    // Named after the glossary so exporting several does not produce a folder of
    // identically named files. Anything a filesystem dislikes becomes a dash.
    const slug = glossaryName
      .trim()
      .replace(/[^\p{L}\p{N}_-]+/gu, "-")
      .replace(/^-+|-+$/g, "")
    anchor.download = slug ? `read-frog-glossary-${slug}.csv` : "read-frog-glossary.csv"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <ConfigItem
      id="glossary-import-export"
      title={i18n.t("options.advanced.glossary.importExport.title")}
      description={
        <>
          {i18n.t("options.advanced.glossary.importExport.description")}
          {/* Qualifies what an import will DO, so it sits with the explanation
              rather than in the action column beside the buttons. The case rule
              and the target language used to live here too; they are columns in
              the file now, which is the only place that can answer them per
              row. */}
          <span className="mt-2 flex flex-wrap items-center gap-2">
            <Select value={mode} onValueChange={(value) => setMode(value as ImportMode)}>
              <SelectTrigger size="sm">
                {/* `render` + explicit children, not a bare `SelectValue`: the
                    bare form shows the raw value ("merge") instead of the label. */}
                <SelectValue render={<span />}>{i18n.t(MODE_LABEL_KEY[mode])}</SelectValue>
              </SelectTrigger>
              <SelectContent align="start">
                <SelectGroup>
                  {IMPORT_MODES.map((importMode) => (
                    <SelectItem key={importMode} value={importMode}>
                      {i18n.t(MODE_LABEL_KEY[importMode])}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </span>
        </>
      }
    >
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="p-0" disabled={isPending}>
          {/* The label fills the button so the whole control opens the picker. */}
          <Label htmlFor={IMPORT_INPUT_ID} className="w-full gap-1 px-2.5 text-[length:inherit]">
            <Icon icon="tabler:file-import" />
            {i18n.t("options.advanced.glossary.import")}
          </Label>
        </Button>
        <input
          id={IMPORT_INPUT_ID}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (!file) return
            // Merge only ever adds, so it needs no confirm. Replace is the one
            // that destroys.
            if (mode === "replace") setPendingReplaceFile(file)
            else void handleImport(file)
            event.target.value = ""
          }}
        />

        <Button variant="outline" size="sm" onClick={() => void handleExport()}>
          <Icon icon="tabler:file-export" />
          {i18n.t("options.advanced.glossary.export")}
        </Button>

        <AlertDialog
          open={pendingReplaceFile !== null}
          onOpenChange={(open) => {
            if (!open) setPendingReplaceFile(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {i18n.t("options.advanced.glossary.importReplaceConfirm.title")}
              </AlertDialogTitle>
              {/* The count, and the fact that replace crosses target languages,
                  are the two things the label "Replace list" does not say. */}
              <AlertDialogDescription>
                {i18n.t("options.advanced.glossary.importReplaceConfirm.description", [
                  String(terms.length),
                ])}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                {i18n.t("options.advanced.glossary.importReplaceConfirm.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={isPending || !termCountKnown}
                onClick={() => {
                  const file = pendingReplaceFile
                  setPendingReplaceFile(null)
                  if (file) void handleImport(file)
                }}
              >
                {i18n.t("options.advanced.glossary.importReplaceConfirm.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ConfigItem>
  )
}
