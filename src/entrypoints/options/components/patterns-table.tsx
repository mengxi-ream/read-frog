import type { AddPatternResult } from "@/hooks/use-pattern-list"
import { Icon } from "@iconify/react"
import { useState } from "react"
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
import { toastManager } from "@/components/ui/base-ui/toast"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"

/** Width hint for the trailing action cell, applied to the header and body rows alike. */
const ACTION_COLUMN = "[&>*:last-child]:w-16"

interface PatternsTableProps {
  patterns: string[]
  /** Reports back why the add landed or didn't; see `usePatternList`. */
  onAddPattern: (pattern: string) => AddPatternResult
  onRemovePattern: (pattern: string) => void
  placeholderText: string
  tableHeaderText: string
  className?: string
  /**
   * The box the rows sit in. Capped and scrolling by default, so a list inside a settings
   * row can't grow until it pushes the section off screen; pass `max-h-none` where the list
   * has the room to run its full length.
   */
  rowsClassName?: string
}

export function PatternsTable({
  patterns,
  onAddPattern,
  onRemovePattern,
  placeholderText,
  tableHeaderText,
  className,
  rowsClassName,
}: PatternsTableProps) {
  const [inputValue, setInputValue] = useState("")

  // This is the only place a pattern is typed in, so it is where the outcome is reported.
  // A rejected pattern keeps its text in the field so it can be corrected rather than
  // retyped.
  const handleAddPattern = () => {
    const result = onAddPattern(inputValue)
    if (result === "duplicate") {
      toastManager.add({ type: "error", title: i18n.t("options.patterns.duplicate") })
      return
    }
    if (result === "empty") return

    setInputValue("")
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddPattern()
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <Input
          placeholder={placeholderText}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
        />
        <Button size="icon" variant="outline" onClick={handleAddPattern}>
          <Icon icon="tabler:plus" />
        </Button>
      </div>
      {/* Nothing to head up until there is a row, so the whole table drops out.

          Header and rows are separate tables so only the rows sit in a scroll box: keeping
          them in one table would put the header inside it too, which drags the scrollbar
          track up alongside the header. Both rows carry ACTION_COLUMN so the action cell
          lines up across the split. */}
      {patterns.length > 0 && (
        <div>
          <Table>
            <TableHeader>
              <TableRow className={ACTION_COLUMN}>
                <TableHead>{tableHeaderText}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
          </Table>
          <div className={cn("max-h-42 overflow-y-auto", rowsClassName)}>
            <Table>
              <TableBody>
                {patterns.map((pattern, index) => (
                  <TableRow key={pattern} index={index} className={ACTION_COLUMN}>
                    <TableCell>{pattern}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="icon-xs"
                        onClick={() => onRemovePattern(pattern)}
                      >
                        <Icon icon="tabler:trash" className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
