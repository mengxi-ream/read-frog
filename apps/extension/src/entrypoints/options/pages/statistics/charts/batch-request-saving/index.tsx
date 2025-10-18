import type { BatchRequestInfo } from './chart'
import { Tabs, TabsList, TabsTrigger } from '@repo/ui/components/tabs'
import { useState } from 'react'
import ChartTitle from '../../components/chart-title'
import Chart from './chart'

function getBatchRequestSavingData (timeRange: string) {
  switch (timeRange) {
    case '1d':
      return []
    case '5d':
      return []
    case '7d':
      return []
    case '30d':
      return []
  }
}

export default function BatchRequestSaving() {
  const [batchRequestSavingData, setBatchRequestSavingData] = useState<BatchRequestInfo[]>([])

  const toggleTimeRange = (timeRange: string) => {
    setBatchRequestSavingData(getBatchRequestSavingData(timeRange))
  }

  return (
    <div className="dark:bg-[#202226] dark:text-white">
      <ChartTitle title="批量翻译节省请求" />
      <Tabs defaultValue="7" className="w-[400px]" onValueChange={toggleTimeRange}>
        <TabsList>
          <TabsTrigger value="1">1d</TabsTrigger>
          <TabsTrigger value="5">5d</TabsTrigger>
          <TabsTrigger value="7">7d</TabsTrigger>
          <TabsTrigger value="30">30d</TabsTrigger>
        </TabsList>
      </Tabs>
      <Chart data={batchRequestSavingData} />
    </div>
  )
}
