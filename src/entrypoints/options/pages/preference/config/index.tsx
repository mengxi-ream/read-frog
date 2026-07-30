import { MAX_BACKUPS_COUNT } from "@/utils/constants/backup"
import { i18n } from "@/utils/i18n"
import { ConfigNavItem } from "../../../components/config-nav-item"
import { ConfigSection } from "../../../components/config-section"
import { GoogleDriveSyncConfigItem } from "./google-drive-sync"
import { ManualConfigSyncConfigItems } from "./manual-config-sync"
import { ResetConfigItem } from "./reset-config"

export function ConfigManagementSection() {
  return (
    <ConfigSection title={i18n.t("options.preference.config.title")}>
      <GoogleDriveSyncConfigItem />
      <ManualConfigSyncConfigItems />
      <ConfigNavItem
        to="/preference/config-backup"
        title={i18n.t("options.preference.config.backup.title")}
        description={i18n.t("options.preference.config.backup.description", [MAX_BACKUPS_COUNT])}
      />
      <ResetConfigItem />
    </ConfigSection>
  )
}
