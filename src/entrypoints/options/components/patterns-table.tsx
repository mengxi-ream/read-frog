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
import { cn } from "@/utils/styles/utils"

/** Width hint for the trailing action cell, applied to the header and body rows alike. */
const ACTION_COLUMN = "[&>*:last-child]:w-16"

interface PatternsTableProps {
  patterns: string[]
  onAddPattern: (pattern: string) => void
  onRemovePattern: (pattern: string) => void
  placeholderText: string
  tableHeaderText: string
  className?: string
}

export function PatternsTable({
  patterns,
  onAddPattern,
  onRemovePattern,
  placeholderText,
  tableHeaderText,
  className,
}: PatternsTableProps) {
  const [inputValue, setInputValue] = useState("")

  const handleAddPattern = () => {
    onAddPattern(inputValue)
    setInputValue("")
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onAddPattern(inputValue)
      setInputValue("")
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
        <Button size="icon" onClick={handleAddPattern}>
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
          {/* Caps the list at ~6 rows; past that the rows scroll under the header. */}
          <div className="max-h-40 overflow-y-auto">
            <Table>
              <TableBody>
                {patterns.map((pattern, index) => (
                  <TableRow key={pattern} index={index} className={ACTION_COLUMN}>
                    <TableCell>{pattern}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="icon-sm"
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
