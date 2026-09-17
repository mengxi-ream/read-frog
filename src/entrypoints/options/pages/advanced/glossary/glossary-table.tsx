import type GlossaryTerm from "@/utils/db/dexie/tables/glossary-term"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Input } from "@/components/ui/base-ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/base-ui/table"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { GlossaryTermRow } from "./term-row"
import { useGlossaryTerms } from "./use-glossary"

/**
 * Rows shown at once. The cap is 20,000 terms, and nobody scrolls to row 12,000
 * — they search. Paging keeps the DOM small without pulling in a virtualiser
 * this repo does not currently depend on.
 */
const PAGE_SIZE = 50

/**
 * The order the rows are shown in, frozen per row for as long as the table is open.
 *
 * `listGlossaryTerms` orders by `updatedAt` and `saveGlossaryTerm` restamps it on
 * every write, so without this an edit would move the row the user just finished
 * editing to the far end of the list — off the page entirely on any list longer
 * than one. That is the same trap `setGlossaryTermEnabled` sidesteps by not
 * restamping at all, which an edit cannot do: `updatedAt` is what decides the
 * winner when two devices' glossaries are reconciled.
 *
 * Rows keep the number they were first given, and anything new is numbered last
 * and so lands at the end — which is where a freshly added term has always
 * appeared. Numbers are only handed out, never reclaimed, so a delete cannot pull
 * a later row into a slot that is already spoken for.
 *
 * Numbering happens during render rather than in an effect, which is React's own
 * answer for state that has to remember something across renders: the component
 * re-runs immediately with the new numbers and only that result is committed, so
 * no render ever paints rows in an order that is about to change.
 *
 * The condition is about the rows themselves, NOT about the identity of the array
 * holding them, and that is load-bearing. A render-phase update has to make its
 * own condition false or it never stops, and `terms` is a fresh array on every
 * render for as long as the query is loading — `useGlossaryTerms` has no data
 * yet, so the `= []` default builds a new one each time. Under StrictMode, which
 * runs the component twice, that loading render happens twice in a row, so an
 * `!==` check against the previous array can never settle: it re-rendered until
 * React gave up with "Too many re-renders" and the whole options page dropped
 * into its recovery screen, every single time a glossary was opened in a dev
 * build. Asking "is any row unnumbered?" ends after one update whatever the
 * array identity does, and is simply false while the list is empty.
 */
function useStableOrder(terms: GlossaryTerm[]) {
  const [positions, setPositions] = useState<ReadonlyMap<string, number>>(() => new Map())

  if (terms.some((term) => !positions.has(term.id))) {
    setPositions(numberNewRows(terms, positions))
  }

  return useMemo(
    () =>
      terms
        .map((term, index) => ({
          term,
          // Not yet numbered means this render is the one it arrived in — so it
          // sorts by where it already is, after everything that has a number.
          // That is the slot it is about to be given, so the list never settles
          // visibly.
          position: positions.get(term.id) ?? positions.size + index,
        }))
        .sort((a, b) => a.position - b.position)
        .map((entry) => entry.term),
    [terms, positions],
  )
}

function numberNewRows(
  terms: GlossaryTerm[],
  previous: ReadonlyMap<string, number>,
): ReadonlyMap<string, number> {
  const positions = new Map(previous)
  for (const term of terms) {
    if (!positions.has(term.id)) positions.set(term.id, positions.size)
  }
  return positions
}

export function GlossaryTable({ glossaryId }: { glossaryId: string }) {
  const { data: terms = [], isLoading } = useGlossaryTerms(glossaryId)
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  // At most one row is editable at a time: two open rows could both be renamed
  // onto the same term, and only the second would be told.
  const [editingId, setEditingId] = useState<string | null>(null)

  const ordered = useStableOrder(terms)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle === "") return ordered
    return ordered.filter(
      (term) =>
        term.source.toLowerCase().includes(needle) || term.target.toLowerCase().includes(needle),
    )
  }, [ordered, query])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  return (
    <ConfigItem
      id="glossary-terms-list"
      orientation="vertical"
      title={i18n.t("options.advanced.glossary.list.title")}
      description={i18n.t("options.advanced.glossary.list.description")}
    >
      <div className="flex flex-col gap-3">
        {terms.length > 0 && (
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(0)
              // Searching or paging can carry the open row off screen, and its
              // draft dies with the unmounted cells. Closing it here is what
              // stops the table from reopening an empty editor on the way back.
              setEditingId(null)
            }}
            placeholder={i18n.t("options.advanced.glossary.searchPlaceholder")}
          />
        )}

        {/* No horizontal scroll: a long term must not make the whole table
            pannable. `table-fixed` is what makes the column widths below
            binding, and is what gives the cells a width to truncate against.

            Capped and scrolling, because a full page of 50 rows measured 2,431px
            — nearly three screens — and everything after it, including the
            export that "delete all" tells you to take first, sat below that.
            Header and body stay in ONE table so the two unsized columns keep
            dividing the remaining width identically.

            The border and the radius are on the SCROLL container rather than a
            wrapper around it, so `overflow` clips the rows to the rounded
            corners instead of letting them square it off. */}
        <Table
          className="table-fixed"
          containerClassName="max-h-[420px] overflow-y-auto rounded-md border"
        >
          {/* Pinned on the CELLS, not on `<thead>`: a sticky row group is
              painted under the body's cells whatever its z-index, so the rows
              scrolled straight through it.

              `z-20` on the header ROW is the other half. Every `TableRow` is
              `relative z-10` for the pointer-following highlight, which makes
              each body row a stacking context at the same level as the header's
              — and later in document order, so it won. A z-index on the cells
              cannot fix that: they are trapped inside their own row's context. */}
          <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:bg-background">
            <TableRow className="z-20">
              {/* Header text would be wider than the control it labels and
                  would set the column width under `table-fixed`. The name is
                  on each checkbox instead. */}
              <TableHead className="w-12">
                <span className="sr-only">{i18n.t("options.advanced.glossary.columnEnabled")}</span>
              </TableHead>
              {/* Left unsized on purpose: under `table-fixed` the columns with
                  no width divide what the two fixed ones leave, so these two
                  stay equal halves without anyone doing the arithmetic. A long
                  term must not starve the translation column. */}
              <TableHead>{i18n.t("options.advanced.glossary.columnSource")}</TableHead>
              <TableHead>{i18n.t("options.advanced.glossary.columnTarget")}</TableHead>
              {/* Sized, so the two term columns keep dividing the rest evenly. */}
              <TableHead className="w-40">
                {i18n.t("options.advanced.glossary.columnTargetLanguage")}
              </TableHead>
              {/* Wide enough for the two buttons every row carries — edit and
                  delete while reading, save and cancel while editing — so the
                  term columns do not resize the moment a row is opened. */}
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((term: GlossaryTerm) => (
              <GlossaryTermRow
                key={term.id}
                term={term}
                glossaryId={glossaryId}
                isEditing={editingId === term.id}
                onEdit={() => setEditingId(term.id)}
                onDone={() => setEditingId(null)}
              />
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {isLoading
                    ? i18n.t("options.advanced.glossary.loading")
                    : terms.length === 0
                      ? i18n.t("options.advanced.glossary.empty")
                      : i18n.t("options.advanced.glossary.noMatches")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          {/* This glossary's own total, with no cap beside it: the 20,000 cap
              counts the whole library, so pairing it with a per-glossary number
              told the user they had room when the library was nearly full — and
              then refused the add with "your glossary is full". The cap now
              lives on the library section, at the scope it is enforced on.
              Reuses the list row's two strings, which already carry the
              singular English needs. */}
          <span>
            {terms.length === 1
              ? i18n.t("options.advanced.glossary.summary.termsOne")
              : i18n.t("options.advanced.glossary.summary.terms", [String(terms.length)])}
          </span>
          {pageCount > 1 && (
            <span className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage === 0}
                onClick={() => {
                  setPage(currentPage - 1)
                  setEditingId(null)
                }}
              >
                {i18n.t("options.advanced.glossary.previous")}
              </Button>
              {i18n.t("options.advanced.glossary.pageOf", [
                String(currentPage + 1),
                String(pageCount),
              ])}
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage >= pageCount - 1}
                onClick={() => {
                  setPage(currentPage + 1)
                  setEditingId(null)
                }}
              >
                {i18n.t("options.advanced.glossary.next")}
              </Button>
            </span>
          )}
        </div>
      </div>
    </ConfigItem>
  )
}
