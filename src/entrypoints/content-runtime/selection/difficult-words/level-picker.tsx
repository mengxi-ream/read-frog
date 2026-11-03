import type { VocabLang, VocabLevel } from "@read-frog/api-contract"
import { VOCAB_LEVELS } from "@read-frog/api-contract"
import { IconX } from "@tabler/icons-react"
import { useState } from "react"
import { NOTRANSLATE_CLASS } from "@/utils/constants/dom-labels"
import {
  SELECTION_CONTENT_OVERLAY_LAYERS,
  SELECTION_CONTENT_OVERLAY_ROOT_ATTRIBUTE,
} from "@/utils/constants/selection-overlay-layers"
import { getLevelDescription, getLevelLabel } from "@/utils/difficult-words/levels"
import { i18n } from "@/utils/i18n"
import { getLanguageName } from "@/utils/language-labels"
import { cn } from "@/utils/styles/utils"

/**
 * Asks the reader's reading level in a language the first time its words are
 * to be marked: the level is where the marking starts, and the reader's
 * clicks move it from there. Described by what one can read at it, in the
 * CEFR's terms, so it can be picked without knowing the scale.
 */
export function LevelPicker({
  lang,
  onPick,
  onDismiss,
}: {
  lang: VocabLang
  /** Resolves once the level is saved; rejects when it could not be. */
  onPick: (level: VocabLevel) => Promise<void>
  onDismiss: () => void
}) {
  const [saving, setSaving] = useState<VocabLevel | null>(null)
  const languageName = getLanguageName(lang)

  return (
    <div
      role="dialog"
      aria-labelledby="read-frog-difficult-words-level-title"
      className={cn(
        NOTRANSLATE_CLASS,
        SELECTION_CONTENT_OVERLAY_LAYERS.selectionOverlay,
        "pointer-events-auto fixed top-4 right-4 flex max-h-[calc(100vh-2rem)] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg",
      )}
      {...{ [SELECTION_CONTENT_OVERLAY_ROOT_ATTRIBUTE]: "" }}
    >
      <div className="flex items-start gap-2 px-4 pt-4 pb-2">
        <div className="min-w-0 flex-1">
          <h2 id="read-frog-difficult-words-level-title" className="text-sm font-semibold">
            {i18n.t("difficultWords.level.title", [languageName])}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {i18n.t("difficultWords.level.description")}
          </p>
        </div>
        <button
          type="button"
          aria-label={i18n.t("difficultWords.level.later")}
          title={i18n.t("difficultWords.level.later")}
          className="-mt-1 -mr-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={onDismiss}
        >
          <IconX className="size-4" />
        </button>
      </div>
      <ul className="flex min-h-0 flex-col gap-1 overflow-y-auto px-2 pb-2">
        {VOCAB_LEVELS.map((level) => (
          <li key={level}>
            <button
              type="button"
              disabled={saving !== null}
              className={cn(
                "flex w-full cursor-pointer items-baseline gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted disabled:cursor-default",
                saving === level && "bg-muted",
                saving !== null && saving !== level && "opacity-50",
              )}
              onClick={() => {
                setSaving(level)
                onPick(level).catch(() => setSaving(null))
              }}
            >
              <span
                className={cn(
                  "shrink-0 text-sm font-semibold tabular-nums",
                  level === "unsure" ? "w-auto" : "w-6",
                )}
              >
                {getLevelLabel(level)}
              </span>
              <span className="min-w-0 text-xs leading-relaxed text-muted-foreground">
                {getLevelDescription(level)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
        {i18n.t("difficultWords.level.footer")}
      </p>
    </div>
  )
}
