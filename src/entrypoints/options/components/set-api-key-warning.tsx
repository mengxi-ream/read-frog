import { Link } from "react-router"
import { i18n } from "@/utils/i18n"

export function SetApiKeyWarning() {
  return (
    <div className="text-xs bg-warning px-2 rounded-md flex items-center gap-1 border border-warning-border">
      {i18n.t("options.setAPIKeyWarning.please")}
      {" "}
      <Link to="/api-providers" className="text-blue-500 hover:underline">{i18n.t("options.apiProviders.title")}</Link>
      {" "}
      {i18n.t("options.setAPIKeyWarning.page")}
    </div>
  )
}
