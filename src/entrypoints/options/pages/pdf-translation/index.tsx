import { useAtom } from "jotai"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { ConfigCard } from "../../components/config-card"
import { PageLayout } from "../../components/page-layout"

export function PdfTranslationPage() {
  const [pdfTranslation, setPdfTranslation] = useAtom(configFieldsAtomMap.pdfTranslation)

  return (
    <PageLayout title="PDF Translation">
      <div className="*:border-b [&>*:last-child]:border-b-0">
        <ConfigCard
          id="pdf-translation-toggle"
          title="Translate PDF documents"
          description="When enabled, navigating to a PDF file opens it in the Read Frog PDF viewer with bilingual translation overlay."
        >
          <div className="flex w-full justify-end">
            <Switch
              checked={pdfTranslation.enabled}
              onCheckedChange={(checked) => {
                void setPdfTranslation({ ...pdfTranslation, enabled: checked })
              }}
            />
          </div>
        </ConfigCard>
      </div>
    </PageLayout>
  )
}
