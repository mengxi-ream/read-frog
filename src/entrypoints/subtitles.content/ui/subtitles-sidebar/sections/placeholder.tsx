import { IconFileTextAi } from "@tabler/icons-react"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/base-ui/empty"
import { i18n } from "@/utils/i18n"

export function PlaceholderSection() {
  return (
    <Empty className="p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconFileTextAi />
        </EmptyMedia>
        <EmptyTitle>{i18n.t("subtitles.sidebar.placeholder.title")}</EmptyTitle>
        <EmptyDescription>{i18n.t("subtitles.sidebar.placeholder.description")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
