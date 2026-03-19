import type { ChartConfig } from "@/components/ui/base-ui/chart"
import type BatchRequestRecord from "@/utils/db/dexie/tables/batch-request-record"
import { i18n } from "#imports"
import { useAtomValue } from "jotai"
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent } from "@/components/ui/base-ui/card"
import {

  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/base-ui/chart"
import { useBatchRequestRecords } from "@/hooks/use-batch-request-record"
import { addThousandsSeparator } from "@/utils/utils"
import { recentDayAtom } from "./atom"

interface RequestRecordPoint {
  createdAt: string
  originalRequest: number
  batchRequest: number
}

export default function Chart() {
  const recentDay = useAtomValue(recentDayAtom)
  const daysBack = Number(recentDay) - 1

  const { currentPeriodRecords } = useBatchRequestRecords(daysBack)

  const chartConfig = getChartConfig()
  const requestRecordPoints = transformBatchRequestRecordsToChartPoints(currentPeriodRecords)
  const shouldShowPoints = requestRecordPoints.length <= 1

  return (
    <Card className="relative min-w-[400px] flex-1 overflow-hidden border-border/70 shadow-xs">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-linear-to-b from-primary/10 via-primary/4 to-transparent" />
      <CardContent className="relative h-80 pt-4">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <AreaChart
            accessibilityLayer
            data={requestRecordPoints}
            margin={{
              top: 12,
              right: 12,
              bottom: 0,
              left: -18,
            }}
          >
            <defs>
              <linearGradient id="fillOriginalRequest" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartConfig.originalRequest.color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={chartConfig.originalRequest.color} stopOpacity={0.04} />
              </linearGradient>
              <linearGradient id="fillBatchRequest" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartConfig.batchRequest.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={chartConfig.batchRequest.color} stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--color-border)"
              strokeDasharray="3 7"
              opacity={0.45}
            />
            <XAxis
              axisLine={false}
              dataKey="createdAt"
              minTickGap={20}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
              tickLine={false}
              tickMargin={12}
            />
            <YAxis hide />
            <ChartLegend
              align="right"
              content={<ChartLegendContent className="justify-end pb-4" />}
              verticalAlign="top"
            />
            <ChartTooltip
              content={<ChartTooltipContent valueFormatter={formatTooltipValue} />}
              cursor={{ stroke: "var(--color-border)", strokeDasharray: "4 4", opacity: 0.8 }}
            />
            <Area
              dataKey="originalRequest"
              dot={shouldShowPoints ? renderDot(chartConfig.originalRequest.color, 3.5) : false}
              activeDot={renderDot(chartConfig.originalRequest.color, 5.5)}
              fill="url(#fillOriginalRequest)"
              fillOpacity={1}
              isAnimationActive={false}
              stroke={chartConfig.originalRequest.color}
              strokeWidth={2}
              type="monotone"
            />
            <Area
              dataKey="batchRequest"
              dot={shouldShowPoints ? renderDot(chartConfig.batchRequest.color, 3.5) : false}
              activeDot={renderDot(chartConfig.batchRequest.color, 5.5)}
              fill="url(#fillBatchRequest)"
              fillOpacity={1}
              isAnimationActive={false}
              stroke={chartConfig.batchRequest.color}
              strokeWidth={2.25}
              type="monotone"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function transformBatchRequestRecordsToChartPoints(batchRequestRecords: BatchRequestRecord[]): RequestRecordPoint[] {
  const requestTimesGroupByDay: Record<string, { originalRequestCount: number, batchRequestCount: number }> = {}

  for (const record of batchRequestRecords) {
    const createdAt = record.createdAt.toLocaleDateString("en-CA")
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
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
    .map(([createdAt, { originalRequestCount, batchRequestCount }]) => ({
      createdAt,
      originalRequest: originalRequestCount,
      batchRequest: batchRequestCount,
    }))
}

function getChartConfig() {
  return {
    originalRequest: {
      color: "var(--color-chart-2)",
      label: i18n.t("options.statistics.batchRequest.originalRequestCount"),
    },
    batchRequest: {
      color: "var(--color-chart-1)",
      label: i18n.t("options.statistics.batchRequest.batchRequestCount"),
    },
  } satisfies ChartConfig
}

function formatTooltipValue(value: string | number | ReadonlyArray<string | number> | undefined) {
  if (typeof value !== "number") {
    return value
  }

  return addThousandsSeparator(value)
}

function renderDot(color: string, radius: number) {
  return {
    r: radius,
    fill: color,
    stroke: "var(--color-background)",
    strokeWidth: 2,
  }
}
