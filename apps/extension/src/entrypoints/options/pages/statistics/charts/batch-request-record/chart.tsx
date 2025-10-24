import type { IAreaChartSpec } from '@visactor/react-vchart'
import type BatchRequestRecord from '@/utils/db/dexie/tables/batch-request-record'
import { i18n } from '#imports'
import { VChart } from '@visactor/react-vchart'
import { useAtomValue } from 'jotai'
import { useBatchRequestRecords } from '@/hooks/use-batch-request-record'
import { recentDayAtom } from './atom'

interface RequestRecordPoint {
  createdAt: string
  type: 'originalRequest' | 'batchRequest'
  count: number
}

function generateSpec(requestRecordPoints: RequestRecordPoint[]): IAreaChartSpec {
  const uniqueDates = new Set(requestRecordPoints.map(p => p.createdAt)).size
  const shouldShowPoints = uniqueDates <= 1

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
      visible: shouldShowPoints,
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
      mark: {
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
    autoFit: true,
  }
}

export default function Chart() {
  const recentDay = useAtomValue(recentDayAtom)
  const daysBack = Number(recentDay) - 1

  const { currentPeriodRecords } = useBatchRequestRecords(daysBack)

  const requestRecordPoints = transformBatchRequestRecordsToChartPoints(currentPeriodRecords)
  const spec = generateSpec(requestRecordPoints)

  return (
    <div className="relative h-80 flex-1 min-w-[400px] overflow-hidden">
      <div className="absolute inset-0">
        <VChart spec={spec} />
      </div>
    </div>
  )
}

function transformBatchRequestRecordsToChartPoints(batchRequestRecords: BatchRequestRecord[]): RequestRecordPoint[] {
  const requestTimesGroupByDay: Record<string, { originalRequestCount: number, batchRequestCount: number }> = {}

  for (const record of batchRequestRecords) {
    const createdAt = record.createdAt.toLocaleDateString('en-CA')
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
