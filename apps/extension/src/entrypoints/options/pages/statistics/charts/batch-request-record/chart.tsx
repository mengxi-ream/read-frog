import type { ILineChartSpec } from '@visactor/vchart'
import type BatchRequestRecord from '@/utils/db/dexie/tables/batch-request-record'
import { VChart } from '@visactor/vchart'
import { useAtomValue } from 'jotai'
import { useEffect, useRef } from 'react'
import { batchRequestRecordsAtom } from './atom'

interface RequestRecordPoint {
  createdAt: string
  type: 'originalRequest' | 'batchRequest'
  count: number
}

function generateSpec(requestRecordPoints: RequestRecordPoint[]): ILineChartSpec {
  return {
    type: 'line',
    data: {
      values: requestRecordPoints,
    },
    xField: 'createdAt',
    yField: 'count',
    seriesField: 'type',
    animation: true,
    point: {
      visible: false,
    },
    legends: {
      visible: true,
      type: 'discrete',
      item: {
        label: {
          formatMethod: type => type === 'originalRequest' ? '原始请求数' : '应用批量翻译后请求数',
        },
      },
    },
    tooltip: {
      dimension: {
        content: [
          {
            key: datum => datum?.type === 'originalRequest' ? '原始请求数' : '应用批量翻译后请求数',
            value: datum => datum?.count ?? 0,
          },
        ],
      },
    },
    axes: [
      {
        orient: 'left',
        visible: false,
      },
      {
        orient: 'bottom',
        visible: true,
        grid: {
          visible: true,
        },
      },
    ],
    line: {
      style: {
        curveType: 'monotone',
        stroke: ({ type }) => type === 'originalRequest' ? 'oklch(0.8549 0 0)' : 'oklch(0.502 0.2 270)',
        lineDash: ({ type }) => type === 'originalRequest' ? [5] : [0],
      },
    },
  }
}

export default function Chart() {
  const batchRequestRecords = useAtomValue(batchRequestRecordsAtom)
  const containerRef = useRef<HTMLDivElement>(null)
  const lineChartRef = useRef<VChart>(null)

  const requestRecordPoints = transformBatchRequestRecordsToChartPoints(batchRequestRecords)
  const spec = generateSpec(requestRecordPoints)

  const initializeChart = (spec: ILineChartSpec) => {
    if (!containerRef.current)
      return

    lineChartRef.current = new VChart(spec, { dom: containerRef.current })
    lineChartRef.current.renderSync()
  }

  useEffect(() => {
    if (lineChartRef.current) {
      void lineChartRef.current.updateSpec(spec)
      return
    }

    initializeChart(spec)
  }, [containerRef, lineChartRef, spec])

  return (
    <div ref={containerRef} className="h-full flex-auto" />
  )
}

function transformBatchRequestRecordsToChartPoints(batchRequestRecords: BatchRequestRecord[]): RequestRecordPoint[] {
  const requestTimesGroupByDay: Record<string, { originalRequestCount: number, batchRequestCount: number }> = {}

  for (const record of batchRequestRecords) {
    const createdAt = record.createdAt.toISOString().split('T')[0]
    if (!requestTimesGroupByDay[createdAt]) {
      requestTimesGroupByDay[createdAt] = {
        originalRequestCount: 0,
        batchRequestCount: 0,
      }
    }
    requestTimesGroupByDay[createdAt].originalRequestCount += record.originalRequestCount
    requestTimesGroupByDay[createdAt].batchRequestCount += 1
  }

  return Object
    .entries(requestTimesGroupByDay)
    .flatMap(([createdAt, { originalRequestCount, batchRequestCount }]) => (
      [
        {
          createdAt,
          type: 'originalRequest',
          count: originalRequestCount,
        },
        {
          createdAt,
          type: 'batchRequest',
          count: batchRequestCount,
        },
      ]
    ))
}
