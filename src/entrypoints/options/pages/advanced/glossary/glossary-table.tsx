import type GlossaryTerm from "@/utils/db/dexie/tables/glossary-term"
import { Icon } from "@iconify/react"
import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/base-ui/badge"
import { Button } from "@/components/ui/base-ui/button"
import { Checkbox } from "@/components/ui/base-ui/checkbox"
import { Input } from "@/components/ui/base-ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/base-ui/table"
import { MAX_GLOSSARY_TERMS } from "@/utils/constants/glossary"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { TruncatedText } from "../../../components/truncated-text"
import { useDeleteGlossaryTerm, useGlossaryTerms, useSetGlossaryTermEnabled } from "./use-glossary"

/**
 * Rows shown at once. The cap is 20,000 terms, and nobody scrolls to row 12,000
 * — they search. Paging keeps the DOM small without pulling in a virtualiser
 * this repo does not currently depend on.
 */
const PAGE_SIZE = 50

export function GlossaryTable() {
  const { data: terms = [], isLoading } = useGlossaryTerms()
  const { mutate: deleteTerm } = useDeleteGlossaryTerm()
  const { mutate: setEnabled } = useSetGlossaryTermEnabled()
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle === "") return terms
    return terms.filter(
      (term) =>
        term.source.toLowerCase().includes(needle) || term.target.toLowerCase().includes(needle),
    )
  }, [terms, query])

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
            }}
            placeholder={i18n.t("options.advanced.glossary.searchPlaceholder")}
          />
        )}

        {/* No horizontal scroll: a long term must not make the whole table
            pannable. `table-fixed` is what makes the column widths below
            binding, and is what gives the cells a width to truncate against. */}
        <div className="rounded-md border">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                {/* Header text would be wider than the control it labels and
                    would set the column width under `table-fixed`. The name is
                    on each checkbox instead. */}
                <TableHead className="w-12">
                  <span className="sr-only">
                    {i18n.t("options.advanced.glossary.columnEnabled")}
                  </span>
                </TableHead>
                {/* Left unsized on purpose: under `table-fixed` the columns with
                    no width divide what the two fixed ones leave, so these two
                    stay equal halves without anyone doing the arithmetic. A long
                    term must not starve the translation column. */}
                <TableHead>{i18n.t("options.advanced.glossary.columnSource")}</TableHead>
                <TableHead>{i18n.t("options.advanced.glossary.columnTarget")}</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((term: GlossaryTerm) => (
                <TableRow key={term.id}>
                  <TableCell>
                    <Checkbox
                      checked={term.enabled}
                      // The row already reads as the term, so the label names
                      // which one this box belongs to rather than saying "enabled"
                      // fifty times over.
                      aria-label={i18n.t("options.advanced.glossary.toggleTerm", [term.source])}
                      onCheckedChange={(checked) => setEnabled({ id: term.id, enabled: checked })}
                    />
                  </TableCell>
                  {/* Dimmed rather than hidden or moved: a disabled term is still
                      the user's, and it must stay exactly where they left it so
                      the box they just unticked is the box they can retick. */}
                  <TableCell className={term.enabled ? "font-medium" : "font-medium opacity-50"}>
                    <span className="flex items-center gap-2">
                      <TruncatedText text={term.source} className="min-w-0" />
                      {/* Only case-sensitive terms are marked: the default needs no
                          badge, and labelling every row would be noise. `shrink-0`
                          so the term truncates instead of squeezing the badge. */}
                      {term.caseSensitive && (
                        <Badge variant="outline" className="shrink-0 font-normal">
                          {i18n.t("options.advanced.glossary.caseSensitive")}
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  {/* An empty target is the keep-the-original case, spelled out
                      rather than left as a blank cell that reads like missing data. */}
                  <TableCell className={term.enabled ? undefined : "opacity-50"}>
                    {term.target === "" ? (
                      <span className="text-muted-foreground">
                        {i18n.t("options.advanced.glossary.keepOriginal")}
                      </span>
                    ) : (
                      <TruncatedText text={term.target} />
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={i18n.t("options.advanced.glossary.delete")}
                      onClick={() => deleteTerm(term.id)}
                    >
                      <Icon icon="tabler:trash" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
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
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {i18n.t("options.advanced.glossary.count", [
              String(terms.length),
              String(MAX_GLOSSARY_TERMS),
            ])}
          </span>
          {pageCount > 1 && (
            <span className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
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
                onClick={() => setPage(currentPage + 1)}
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
