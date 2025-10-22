import { Icon } from '@iconify/react'
import { Button } from '@repo/ui/components/button'
import { Input } from '@repo/ui/components/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/table'
import { useState } from 'react'

interface DisabledPatternsTableProps {
  patterns: string[]
  onAddPattern: (pattern: string) => void
  onRemovePattern: (pattern: string) => void
  placeholderText: string
  tableHeaderText: string
}

export function DisabledPatternsTable({
  patterns,
  onAddPattern,
  onRemovePattern,
  placeholderText,
  tableHeaderText,
}: DisabledPatternsTableProps) {
  const [inputValue, setInputValue] = useState('')

  const handleAddPattern = () => {
    onAddPattern(inputValue)
    setInputValue('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onAddPattern(inputValue)
      setInputValue('')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          placeholder={placeholderText}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
        />
        <Button className="size-9" onClick={handleAddPattern}>
          <Icon icon="tabler:plus" className="size-5" />
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">
              {tableHeaderText}
            </TableHead>
            <TableHead className="text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {patterns.map(pattern => (
            <TableRow key={pattern}>
              <TableCell>{pattern}</TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="icon" onClick={() => onRemovePattern(pattern)}>
                  <Icon icon="tabler:trash" className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
