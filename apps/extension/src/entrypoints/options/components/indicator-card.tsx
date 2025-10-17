import { Card, CardContent } from '@repo/ui/components/card'
import { cn } from '@repo/ui/lib/utils'
import { IconArrowDown, IconArrowUp } from '@tabler/icons-react'
import React, { Activity } from 'react'

export function IndicatorCard(
  { title, value, icon, comparison }:
  { title: string, value: string | number, icon: React.ReactNode, comparison: number },
) {
  return (
    <Card className="py-4">
      <CardContent className="w-full p-2 flex gap-2">
        <div className="flex items-center justify-center p-3 rounded-2xl bg-primary-strong">
          {icon}
        </div>
        <div className="flex flex-col flex-auto gap-2">
          <h3 className="text-gray-800">{title}</h3>
          <div className="flex flex-auto">
            <span>{value}</span>
            <div className={
              cn('flex flex-auto items-center', comparison >= 0 ? 'text-primary' : 'text-danger')
            }
            >
              <Activity mode={comparison >= 0 ? 'visible' : 'hidden'}>
                <IconArrowUp className="size-4" />
              </Activity>
              <Activity mode={comparison < 0 ? 'visible' : 'hidden'}>
                <IconArrowDown className="size-4" />
              </Activity>
              {comparison}
              %
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
