import type { IAreaChartSpec } from '@visactor/vchart'
import type BatchRequestRecord from '@/utils/db/dexie/tables/batch-request-record'
import { i18n } from '#imports'
import { VChart } from '@visactor/vchart'
import { useAtomValue } from 'jotai'
import { useEffect, useRef } from 'react'
import { currentPeriodBatchRequestRecordsAtom } from './atom'

interface RequestRecordPoint {
  createdAt: string
  type: 'originalRequest' | 'batchRequest'
  count: number
}

function generateSpec(requestRecordPoints: RequestRecordPoint[]): IAreaChartSpec {
  return {
    type: 'area',
    data: {
      id: 'data',
      values: requestRecordPoints,
    },
    xField: 'createdAt',
    yField: 'count',
    seriesField: 'type',
    point: {
      visible: false,
    },
    legends: {
      visible: true,
      type: 'discrete',
      item: {
        label: {
          formatMethod: type => type === 'originalRequest'
            ? i18n.t('options.statistics.batchRequest.originalRequestCount')
            : i18n.t('options.statistics.batchRequest.batchRequestCount'),
        },
      },
    },
    tooltip: {
      dimension: {
        content: [
          {
            key: datum => datum?.type === 'originalRequest'
              ? i18n.t('options.statistics.batchRequest.originalRequestCount')
              : i18n.t('options.statistics.batchRequest.batchRequestCount'),
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
    ],
    stack: false,
    color: {
      type: 'ordinal',
      domain: ['originalRequest', 'batchRequest'],
      range: ['#dadada', '#46d6b0'],
    },
    area: {
      style: {
        fill: {
          gradient: 'linear',
          x0: 0.5,
          y0: 0,
          x1: 0.5,
          y1: 1,
          stops: [
            {
              offset: 0,
              opacity: 1,
            },
            {
              offset: 1,
              opacity: 0.3,
            },
          ],
        },
      },
    },
    line: {
      style: {
        curveType: 'monotone',
      },
    },
  }
}

export default function Chart() {
  const batchRequestRecords = useAtomValue(currentPeriodBatchRequestRecordsAtom)

  const requestRecordPoints = transformBatchRequestRecordsToChartPoints(batchRequestRecords)

  const containerRef = useRef<HTMLDivElement>(null)
  const lineChartRef = useRef<VChart>(null)

  const spec = generateSpec(requestRecordPoints)

  const initializeChart = (spec: IAreaChartSpec) => {
    if (!containerRef.current)
      return

    lineChartRef.current = new VChart(spec, { dom: containerRef.current })
    lineChartRef.current.renderSync()
  }

  useEffect(() => {
    if (lineChartRef.current) {
      void lineChartRef.current.updateData('data', requestRecordPoints)
      return
    }

    initializeChart(spec)
  }, [containerRef, lineChartRef, requestRecordPoints, spec])

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
