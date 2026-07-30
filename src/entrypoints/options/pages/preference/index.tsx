import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import { AppearanceAndLanguageSection } from "./appearance-and-language"
import { ExtensionActivationSection } from "./extension-activation"

export function PreferencePage() {
  return (
    <PageLayout
      title={i18n.t("options.preference.title")}
      innerClassName="flex flex-col gap-10 pt-6"
    >
      <AppearanceAndLanguageSection />
      <ExtensionActivationSection />
    </PageLayout>
  )
}
