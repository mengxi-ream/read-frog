import { i18n } from "#imports"
import { PageLayout } from "../../components/page-layout"
import { ProvidersConfig } from "./providers-config"

export function ApiProvidersPage() {
  return (
    <PageLayout
      title={i18n.t("options.apiProviders.title")}
      innerClassName="[&>*]:border-b [&>*:last-child]:border-b-0"
    >
      <ProvidersConfig />
    </PageLayout>
  )
}
