import type { SaveSuggestionSessionResult } from "./use-save-suggestion"
import type { SaveSuggestionNoteRecord } from "@/utils/save-suggestion/types"
import { IconBookmarkPlus } from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/base-ui/button"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { getOutputSchemaFingerprint } from "@/utils/notebase/pending-save"
import { trackSaveSuggestionEvent } from "@/utils/save-suggestion/analytics"
import {
  recordSaveSuggestionAccepted,
  recordSaveSuggestionShown,
} from "@/utils/save-suggestion/cooldown"
import { useSaveToNotebase } from "../custom-action-button/use-save-to-notebase"

function formatNoteValue(value: string | number | null): string | null {
  if (value === null) {
    return null
  }

  const text = typeof value === "number" ? String(value) : value.trim()
  return text.length > 0 ? text : null
}

function NoteRow({
  note,
  primaryFieldName,
  secondaryFieldNames,
}: {
  note: SaveSuggestionNoteRecord
  primaryFieldName: string
  secondaryFieldNames: string[]
}) {
  const primaryValue = formatNoteValue(note[primaryFieldName] ?? null)
  const secondaryValue = secondaryFieldNames
    .map((fieldName) => formatNoteValue(note[fieldName] ?? null))
    .find((value) => value !== null)

  return (
    <div className="rounded-md border bg-background/60 px-2.5 py-1.5">
      <div className="text-sm font-medium [overflow-wrap:anywhere] break-words">{primaryValue}</div>
      {secondaryValue && (
        <div className="truncate text-xs text-muted-foreground">{secondaryValue}</div>
      )}
    </div>
  )
}

export function SaveSuggestionCard({
  suggestion,
  markShownOnce,
}: {
  suggestion: SaveSuggestionSessionResult
  markShownOnce: (sessionKey: string) => boolean
}) {
  const selectionToolbar = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const { save, isSaving } = useSaveToNotebase()
  const [saveState, setSaveState] = useState<"idle" | "saved" | "stale">("idle")

  const { sessionKey, validated, actionSnapshot, dictionaryDraft, firedAt } = suggestion

  useEffect(() => {
    if (!markShownOnce(sessionKey)) {
      return
    }

    // Pessimistic cooldown write: the rejection is recorded the moment the
    // card shows; a successful save rewrites it as an acceptance.
    void recordSaveSuggestionShown()
    trackSaveSuggestionEvent("suggestion_shown", { startedAt: firedAt })
  }, [markShownOnce, sessionKey, firedAt])

  const primaryFieldName = actionSnapshot.outputSchema[0]?.name
  if (!primaryFieldName) {
    return null
  }
  // Secondary line preference: the AI-designated summary field first (it
  // knows which field explains the term, whatever the user named it), then
  // definition-like fields (dictionary template's stable ids), then schema
  // order. Later entries only show when earlier ones are empty.
  const aiSummaryFieldName = validated.summaryFieldName
  const secondaryFields = actionSnapshot.outputSchema.slice(1)
  const secondaryFieldNames = [
    ...secondaryFields.filter((field) => field.name === aiSummaryFieldName),
    ...secondaryFields.filter(
      (field) => field.name !== aiSummaryFieldName && field.id.includes("definition"),
    ),
    ...secondaryFields.filter(
      (field) => field.name !== aiSummaryFieldName && !field.id.includes("definition"),
    ),
  ].map((field) => field.name)

  const handleSave = async () => {
    if (validated.target.kind === "create_dictionary") {
      if (!dictionaryDraft) {
        return
      }

      await save({
        action: dictionaryDraft,
        results: validated.notes,
        actionDraft: dictionaryDraft,
        analyticsSource: "save_suggestion",
      })
      return
    }

    const targetActionId = validated.target.actionId
    const liveAction = selectionToolbar.customActions.find(
      (action) => action.id === targetActionId && action.enabled !== false,
    )
    if (
      !liveAction ||
      getOutputSchemaFingerprint(liveAction.outputSchema) !==
        getOutputSchemaFingerprint(actionSnapshot.outputSchema)
    ) {
      toast.error(i18n.t("saveSuggestion.staleSuggestion"))
      setSaveState("stale")
      return
    }

    const outcome = await save({
      action: liveAction,
      results: validated.notes,
      analyticsSource: "save_suggestion",
    })
    if (outcome === "saved") {
      setSaveState("saved")
      void recordSaveSuggestionAccepted()
      trackSaveSuggestionEvent("suggestion_accepted", {
        startedAt: firedAt,
        actionName: liveAction.name,
      })
    }
  }

  const isButtonDisabled = isSaving || saveState !== "idle"
  const buttonLabel = isSaving
    ? i18n.t("action.saveToNotebaseSaving")
    : saveState === "saved"
      ? i18n.t("saveSuggestion.saved")
      : i18n.t("saveSuggestion.save")

  return (
    <div
      data-slot="save-suggestion-card"
      className="notranslate mx-4 mb-4 space-y-2 rounded-lg border bg-muted/40 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
          <IconBookmarkPlus className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
          <span className="truncate">{i18n.t("saveSuggestion.title")}</span>
        </div>
        <Button
          type="button"
          variant="brand"
          size="sm"
          disabled={isButtonDisabled}
          onClick={() => void handleSave()}
        >
          {buttonLabel}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{i18n.t("saveSuggestion.description")}</p>
      <div className="space-y-1.5">
        {validated.notes.map((note, index) => (
          <NoteRow
            // oxlint-disable-next-line react/no-array-index-key -- notes are a stable per-session snapshot
            key={index}
            note={note}
            primaryFieldName={primaryFieldName}
            secondaryFieldNames={secondaryFieldNames}
          />
        ))}
      </div>
    </div>
  )
}
