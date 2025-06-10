import { useAtom } from 'jotai'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { configFields } from '@/utils/atoms/config'
import { ConfigCard } from '../../components/config-card'

export function AlwaysTranslate() {
  return (
    <ConfigCard title="Always Translate" description="Always translate the webpage">
      <PatternTable />
    </ConfigCard>
  )
}

function PatternTable() {
  const [translateConfig, setTranslateConfig] = useAtom(configFields.translate)
  const [inputValue, setInputValue] = useState('')
  const { autoTranslatePatterns } = translateConfig.page

  const addPattern = (pattern: string) => {
    const cleanedPattern = pattern.trim()
    if (!cleanedPattern)
      return

    setTranslateConfig({
      page: {
        ...translateConfig.page,
        autoTranslatePatterns: [...autoTranslatePatterns, cleanedPattern],
      },
    })
    setInputValue('')
  }

  const removePattern = (pattern: string) => {
    setTranslateConfig({
      page: {
        ...translateConfig.page,
        autoTranslatePatterns: autoTranslatePatterns.filter(p => p !== pattern),
      },
    })
  }

  const handleAddPattern = () => {
    addPattern(inputValue)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addPattern(inputValue)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Enter URL Pattern"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
        />
        <Button className="size-9" onClick={handleAddPattern}>
          <Plus className="size-5" />
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">URL Pattern</TableHead>
            <TableHead className="text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {autoTranslatePatterns.map(pattern => (
            <TableRow key={pattern}>
              <TableCell>{pattern}</TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="icon" onClick={() => removePattern(pattern)}>
                  <Trash2 className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
