import type { ILineChartSpec } from '@visactor/vchart'
import { VChart } from '@visactor/vchart'
import { useEffect, useRef } from 'react'

export interface BatchRequestInfo {
  originalRequestCount: number
  batchRequestCount: number
  savingPercentage: number
  createdAt: string
}

function generateSpec(batchRequestSavingData: BatchRequestInfo[]): ILineChartSpec {
  return {
    type: 'line',
    data: {
      values: batchRequestSavingData,
    },
    xField: 'type',
    yField: 'value',
    seriesField: 'country',
    point: {
      visible: false,
    },
    legends: {
      visible: true,
      inverse: true,
    },
    line: {
      style: {
        curveType: 'monotone',
        stroke: (datum) => {
          switch (datum.country) {
            case 'Africa':
              return 'rgb(204, 204, 204)'
            case 'EU':
              return 'blue'
          }
        },
        lineDash: ({ country }) => {
          switch (country) {
            case 'Africa':
              return [5]
            case 'EU':
              return [0]
          }
        },
      },
    },
  }
}

export default function Chart({ data }: { data: BatchRequestInfo[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const lineChartRef = useRef<VChart>(null)

  const spec = generateSpec(data)

  useEffect(() => {
    if (!containerRef.current || lineChartRef.current)
      return
    lineChartRef.current = new VChart(spec, { dom: containerRef.current })
    lineChartRef.current.renderSync()
  }, [containerRef, lineChartRef, spec])

  return (
    <div ref={containerRef} className="h-96 w-full" />
  )
}
