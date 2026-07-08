import { useAtom } from "jotai"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/base-ui/tabs"
import { useBatchRequestRecords } from "@/hooks/use-batch-request-record"
import { calculateAverageSavePercentage } from "@/utils/batch-request-record"
import { i18n } from "@/utils/i18n"
import { recentDayAtom } from "./atom"

const recentDays = ["5", "7", "30", "60"] as const

export default function Aside() {
  const [recentDay, setRecentDay] = useAtom(recentDayAtom)
  const daysBack = Number(recentDay) - 1

  const { currentPeriodRecords } = useBatchRequestRecords(daysBack)

  const averageSavePercentage = calculateAverageSavePercentage(currentPeriodRecords)

  return (
    <aside className="flex w-80 flex-col gap-y-4 py-4">
      <div className="flex flex-col items-start justify-between gap-2">
        <h2 className="leading-relax items-center text-xl font-medium">
          {i18n.t("options.statistics.batchRequest.title")}
        </h2>
        <span className="leading-relax items-center text-base text-muted-foreground">
          {i18n.t("options.statistics.batchRequest.description")}
        </span>
      </div>
      <div className="flex w-full flex-1 items-center justify-start">
        <span className="text-4xl leading-none font-bold">{averageSavePercentage}</span>
      </div>
      <Tabs className="flex w-full" defaultValue={recentDay} onValueChange={setRecentDay}>
        <TabsList className="w-full bg-background">
          {recentDays.map((recentDayOption) => (
            <TabsTrigger
              key={recentDayOption}
              value={recentDayOption}
              className="data-[state=active]:bg-primary-weak! transition-none data-[state=active]:shadow-none"
            >
              {recentDayOption}D
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </aside>
  )
}
