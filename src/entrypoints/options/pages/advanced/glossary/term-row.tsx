import type GlossaryTerm from "@/utils/db/dexie/tables/glossary-term"
import { Icon } from "@iconify/react"
import { useState } from "react"
import { LanguageCombobox } from "@/components/language-combobox"
import { Badge } from "@/components/ui/base-ui/badge"
import { Button } from "@/components/ui/base-ui/button"
import { Checkbox } from "@/components/ui/base-ui/checkbox"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/base-ui/input-group"
import { TableCell, TableRow } from "@/components/ui/base-ui/table"
import { toastManager } from "@/components/ui/base-ui/toast"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { MAX_GLOSSARY_SOURCE_LENGTH, MAX_GLOSSARY_TARGET_LENGTH } from "@/utils/constants/glossary"
import { i18n } from "@/utils/i18n"
import { getLanguageName } from "@/utils/language-labels"
import { TruncatedText } from "../../../components/truncated-text"
import { saveTermErrorTitle } from "./save-term-error"
import {
  useDeleteGlossaryTerm,
  useSaveGlossaryTerm,
  useSetGlossaryTermEnabled,
} from "./use-glossary"

/** See the note at the source field: a cell's colour is for text, not for fields. */
const EDIT_FIELD_CLASS = "text-foreground"

interface TermRowProps {
  term: GlossaryTerm
  glossaryId: string
  isEditing: boolean
  onEdit: () => void
  /** Leave edit mode, whether the edit was saved or abandoned. */
  onDone: () => void
}

/**
 * One term in the table, reading or being edited.
 *
 * The two states are separate components rather than one row full of branches,
 * so the draft can be plain `useState` seeded from the term: the edit row only
 * exists while the row is being edited, so its initial state is by construction
 * the values that were on screen, and nothing has to reset it on the way in or
 * out. Swapping component type also remounts the cells, which is what discards a
 * half-typed draft when the user cancels.
 */
export function GlossaryTermRow({ term, glossaryId, isEditing, onEdit, onDone }: TermRowProps) {
  return isEditing ? (
    <TermEditRow term={term} glossaryId={glossaryId} onDone={onDone} />
  ) : (
    <TermReadRow term={term} onEdit={onEdit} />
  )
}

/**
 * The enable toggle, which is the one control that works the same in both states.
 *
 * Deliberately still live while the row is being edited: it writes on its own
 * (see `setGlossaryTermEnabled`) and is not part of the draft, so there is no
 * reason to lock the user out of it — and no risk of the save clobbering it,
 * because the save reads `term.enabled` at the moment it is submitted.
 */
function EnabledCell({ term }: { term: GlossaryTerm }) {
  const { mutate: setEnabled } = useSetGlossaryTermEnabled()
  return (
    <TableCell>
      <Checkbox
        checked={term.enabled}
        // The row already reads as the term, so the label names which one this
        // box belongs to rather than saying "enabled" fifty times over.
        aria-label={i18n.t("options.advanced.glossary.toggleTerm", [term.source])}
        onCheckedChange={(checked) => setEnabled({ id: term.id, enabled: checked })}
      />
    </TableCell>
  )
}

function TermReadRow({ term, onEdit }: { term: GlossaryTerm; onEdit: () => void }) {
  const { mutate: deleteTerm } = useDeleteGlossaryTerm()

  return (
    <TableRow>
      <EnabledCell term={term} />
      {/* Dimmed rather than hidden or moved: a disabled term is still the user's,
          and it must stay exactly where they left it so the box they just
          unticked is the box they can retick. */}
      <TableCell className={term.enabled ? "font-medium" : "font-medium opacity-50"}>
        <span className="flex items-center gap-2">
          <TruncatedText text={term.source} className="min-w-0" />
          {/* Only case-sensitive terms are marked: the default needs no badge,
              and labelling every row would be noise. `shrink-0` so the term
              truncates instead of squeezing the badge. */}
          {term.caseSensitive && (
            <Badge variant="outline" className="shrink-0 font-normal">
              {i18n.t("options.advanced.glossary.caseSensitive")}
            </Badge>
          )}
        </span>
      </TableCell>
      {/* An empty target is the keep-the-original case, spelled out rather than
          left as a blank cell that reads like missing data. */}
      <TableCell className={term.enabled ? undefined : "opacity-50"}>
        {term.target === "" ? (
          <span className="text-muted-foreground">
            {i18n.t("options.advanced.glossary.keepOriginal")}
          </span>
        ) : (
          <TruncatedText text={term.target} />
        )}
      </TableCell>
      {/* Every term is listed, in every language, so switching the extension's
          target language never looks like terms went missing — the column is how
          you tell which apply now. */}
      <TableCell className={term.enabled ? undefined : "opacity-50"}>
        <TruncatedText text={getLanguageName(term.targetLang)} />
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            // Names the row, like the enable checkbox: a column of identical
            // "Edit" buttons tells a screen reader user nothing about which
            // term they are on.
            aria-label={i18n.t("options.advanced.glossary.editTerm", [term.source])}
            onClick={onEdit}
          >
            <Icon icon="tabler:pencil" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={i18n.t("options.advanced.glossary.delete")}
            onClick={() => deleteTerm(term.id)}
          >
            <Icon icon="tabler:trash" />
          </Button>
        </span>
      </TableCell>
    </TableRow>
  )
}

function TermEditRow({
  term,
  glossaryId,
  onDone,
}: {
  term: GlossaryTerm
  glossaryId: string
  onDone: () => void
}) {
  const { mutateAsync: saveTerm, isPending } = useSaveGlossaryTerm(glossaryId)
  const [source, setSource] = useState(term.source)
  const [target, setTarget] = useState(term.target)
  const [caseSensitive, setCaseSensitive] = useState(term.caseSensitive)
  const [targetLang, setTargetLang] = useState(term.targetLang)

  const canSave = !isPending && source.trim() !== ""

  const handleSave = async () => {
    if (!canSave) return
    const result = await saveTerm({
      id: term.id,
      input: {
        source,
        target,
        caseSensitive,
        targetLang,
        // Carried explicitly, because `saveGlossaryTerm` defaults a missing
        // `enabled` to `true`: without this, editing a term the user had turned
        // off would quietly turn it back on.
        enabled: term.enabled,
      },
    })
    if (result.ok) {
      onDone()
      return
    }
    // The row stays in edit mode on a refusal — the value the user typed is the
    // only copy of it, and a duplicate or an over-long term is something they
    // fix in place rather than retype.
    toastManager.add({ type: "error", title: saveTermErrorTitle(result.reason) })
  }

  // Enter and Escape on the text fields, where the hands already are. The
  // language combobox is left alone on purpose: Escape there closes its popup,
  // which is what the user means by it while the list is open.
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") void handleSave()
    else if (event.key === "Escape") onDone()
  }

  return (
    <TableRow>
      <EnabledCell term={term} />
      <TableCell>
        {/* The case flag rides ON the term field rather than beside it: it
            qualifies this one term, it is half of the row's `matchKey`, and an
            adjacent control would have taken width from a cell that is already
            holding up to 200 characters. */}
        <InputGroup>
          <InputGroupInput
            value={source}
            maxLength={MAX_GLOSSARY_SOURCE_LENGTH}
            // `Input` sets no colour of its own, and `TableCell` paints its
            // contents `text-muted-foreground` — which is right for a cell of
            // read-only text and wrong for a field, where it made what the user
            // had just typed look like the placeholder.
            className={EDIT_FIELD_CLASS}
            // The row was opened to be edited, so the field it opened for takes
            // focus. Cancelling remounts the read row, which hands focus back to
            // the document rather than trapping it here.
            autoFocus
            aria-label={i18n.t("options.advanced.glossary.columnSource")}
            placeholder={i18n.t("options.advanced.glossary.sourcePlaceholder")}
            onChange={(event) => setSource(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <InputGroupAddon align="inline-end">
            <Tooltip>
              <TooltipTrigger
                render={
                  <InputGroupButton
                    size="icon-xs"
                    // Filled when on, so the state is legible without hovering —
                    // the same thing the read row's badge says.
                    variant={caseSensitive ? "secondary" : "ghost"}
                    aria-pressed={caseSensitive}
                    aria-label={i18n.t("options.advanced.glossary.caseSensitive")}
                    onClick={() => setCaseSensitive(!caseSensitive)}
                  />
                }
              >
                {/* The find-in-page convention, and deliberately not translated:
                    it is a glyph pair standing for letter case, and the tooltip
                    and label beside it carry the meaning in the user's language. */}
                Aa
              </TooltipTrigger>
              <TooltipContent>{i18n.t("options.advanced.glossary.caseSensitive")}</TooltipContent>
            </Tooltip>
          </InputGroupAddon>
        </InputGroup>
      </TableCell>
      <TableCell>
        <InputGroup>
          <InputGroupInput
            value={target}
            maxLength={MAX_GLOSSARY_TARGET_LENGTH}
            className={EDIT_FIELD_CLASS}
            aria-label={i18n.t("options.advanced.glossary.columnTarget")}
            // The same placeholder the add form uses, which is where "leave it
            // empty to keep the original" is spelled out — the read row's
            // "Keep the original" text is gone while the field is open, so this
            // is the only thing saying an empty value is legal.
            placeholder={i18n.t("options.advanced.glossary.targetPlaceholder")}
            onChange={(event) => setTarget(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </InputGroup>
      </TableCell>
      <TableCell>
        <LanguageCombobox
          value={targetLang}
          // Fills the column, which `table-fixed` has already sized: the
          // trigger is `w-auto` by default and would otherwise grow with
          // whichever language name it is showing.
          className="w-full"
          onValueChange={(value) => {
            // No page to detect from, so "auto" is not on offer here — and a
            // term with no language could never be filtered into a prompt.
            if (value === "auto") return
            setTargetLang(value)
          }}
        />
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-1">
          <Button
            size="icon-sm"
            disabled={!canSave}
            aria-label={i18n.t("options.advanced.glossary.save")}
            onClick={() => void handleSave()}
          >
            <Icon icon="tabler:check" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={i18n.t("options.advanced.glossary.cancel")}
            onClick={onDone}
          >
            <Icon icon="tabler:x" />
          </Button>
        </span>
      </TableCell>
    </TableRow>
  )
}
