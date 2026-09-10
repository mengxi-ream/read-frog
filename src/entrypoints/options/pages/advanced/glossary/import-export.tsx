import { Icon } from "@iconify/react"
import { useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Checkbox } from "@/components/ui/base-ui/checkbox"
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
import { parseGlossaryCsv } from "@/utils/glossary/csv"
import { exportGlossaryCsv } from "@/utils/glossary/repository"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { useImportGlossary } from "./use-glossary"

const IMPORT_INPUT_ID = "glossary-import-file"

const IMPORT_MODES = ["merge", "replace"] as const
type ImportMode = (typeof IMPORT_MODES)[number]

const MODE_LABEL_KEY = {
  merge: "options.advanced.glossary.importModeMerge",
  replace: "options.advanced.glossary.importModeReplace",
} as const satisfies Record<ImportMode, string>

export function GlossaryImportExport() {
  const [mode, setMode] = useState<ImportMode>("merge")
  // A CSV carries only source,target — there is no per-row case flag — so the
  // whole file takes one answer, and this is the only place that answer cannot
  // be given per term.
  const [caseSensitive, setCaseSensitive] = useState(false)
  const { mutateAsync: importRows, isPending } = useImportGlossary()

  const handleImport = async (file: File) => {
    const { rows, skipped } = parseGlossaryCsv(await file.text())
    if (rows.length === 0) {
      toastManager.add({ type: "error", title: i18n.t("options.advanced.glossary.importEmpty") })
      return
    }

    const result = await importRows({ rows, mode, caseSensitive })

    // Over the cap the import is refused whole and the exact overflow is named.
    // Truncating would leave the user unable to see which half is missing.
    if (!result.ok) {
      toastManager.add({
        type: "error",
        title: i18n.t("options.advanced.glossary.importOverflow", [String(result.overflowBy ?? 0)]),
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
    const csv = await exportGlossaryCsv()
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "read-frog-glossary.csv"
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
          {/* These two qualify what an import will DO, so they sit with the
              explanation rather than in the action column beside the buttons. */}
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

            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Checkbox checked={caseSensitive} onCheckedChange={setCaseSensitive} />
              {i18n.t("options.advanced.glossary.caseSensitive")}
            </label>
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
            if (file) void handleImport(file)
            event.target.value = ""
          }}
        />

        <Button variant="outline" size="sm" onClick={() => void handleExport()}>
          <Icon icon="tabler:file-export" />
          {i18n.t("options.advanced.glossary.export")}
        </Button>
      </div>
    </ConfigItem>
  )
}
