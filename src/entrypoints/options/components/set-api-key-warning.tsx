import { Link } from "react-router"
import { i18n } from "@/utils/i18n"

export function SetApiKeyWarning() {
  return (
    <div className="border-warning-border flex items-center gap-1 rounded-md border bg-warning px-2 text-xs">
      {i18n.t("options.setAPIKeyWarning.please")}{" "}
      <Link to="/api-providers" className="text-blue-500 hover:underline">
        {i18n.t("options.apiProviders.title")}
      </Link>{" "}
      {i18n.t("options.setAPIKeyWarning.page")}
    </div>
  )
}
