import { Badge } from "@/components/ui/base-ui/badge"
import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import { SpeechSection } from "./speech"
import { VoiceSection } from "./voice"

export function TextToSpeechPage() {
  return (
    <PageLayout
      title={
        <>
          {i18n.t("options.tts.title")}{" "}
          <Badge variant="secondary" className="align-middle">
            Public Beta
          </Badge>
        </>
      }
      description={i18n.t("options.tts.pageDescription")}
      innerClassName="flex flex-col gap-10"
    >
      <VoiceSection />
      <SpeechSection />
    </PageLayout>
  )
}
