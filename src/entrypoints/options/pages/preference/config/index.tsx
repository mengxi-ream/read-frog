import { i18n } from "@/utils/i18n"
import { ConfigSection } from "../../../components/config-section"
import { GoogleDriveSyncConfigItem } from "./google-drive-sync"
import { ManualConfigSyncConfigItems } from "./manual-config-sync"

export function ConfigManagementSection() {
  return (
    <ConfigSection title={i18n.t("options.preference.config.title")}>
      <GoogleDriveSyncConfigItem />
      <ManualConfigSyncConfigItems />
    </ConfigSection>
  )
}
