import { useAtom } from 'jotai'

import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  const [translateConfig, _setTranslateConfig] = useAtom(configFields.translate)
  const { autoTranslatePatterns } = translateConfig.page
  return (
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
              <Button variant="outline" size="icon">
                <Trash2 className="size-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
