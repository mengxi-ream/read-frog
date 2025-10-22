import { i18n } from '#imports'
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
import { useAtom } from 'jotai'
import { useState } from 'react'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { ConfigCard } from '../../components/config-card'

export function SelectionToolbarDisabledSites() {
  return (
    <ConfigCard
      title={i18n.t('options.floatingButtonAndToolbar.selectionToolbar.disabledSites.title')}
      description={i18n.t('options.floatingButtonAndToolbar.selectionToolbar.disabledSites.description')}
    >
      <PatternTable />
    </ConfigCard>
  )
}

function PatternTable() {
  const [selectionToolbarConfig, setSelectionToolbarConfig] = useAtom(configFieldsAtomMap.selectionToolbar)
  const [inputValue, setInputValue] = useState('')
  const { disabledSelectionToolbarPatterns = [] } = selectionToolbarConfig

  const addPattern = (pattern: string) => {
    const cleanedPattern = pattern.trim()
    if (!cleanedPattern || disabledSelectionToolbarPatterns.includes(cleanedPattern))
      return

    void setSelectionToolbarConfig({
      ...selectionToolbarConfig,
      disabledSelectionToolbarPatterns: [...disabledSelectionToolbarPatterns, cleanedPattern],
    })
    setInputValue('')
  }

  const removePattern = (pattern: string) => {
    void setSelectionToolbarConfig({
      ...selectionToolbarConfig,
      disabledSelectionToolbarPatterns: disabledSelectionToolbarPatterns.filter(p => p !== pattern),
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
          placeholder={i18n.t('options.floatingButtonAndToolbar.selectionToolbar.disabledSites.enterUrlPattern')}
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
              {i18n.t('options.floatingButtonAndToolbar.selectionToolbar.disabledSites.urlPattern')}
            </TableHead>
            <TableHead className="text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {disabledSelectionToolbarPatterns.map(pattern => (
            <TableRow key={pattern}>
              <TableCell>{pattern}</TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="icon" onClick={() => removePattern(pattern)}>
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
