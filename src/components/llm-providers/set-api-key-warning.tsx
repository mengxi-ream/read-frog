import type { ProviderConfig } from "@/types/config/provider"
import { Link, useInRouterContext } from "react-router"
import { isAPIProviderConfig, isPureAPIProvider } from "@/types/config/provider"
import { i18n } from "@/utils/i18n"
import { buildProviderConfigRoute, openOptionsPage } from "@/utils/navigation"

const LINK_CLASS = "cursor-pointer text-blue-500 hover:underline"

/** Only providers that authenticate with a key of the user's own can be missing one. */
function needsApiKeyWarning(
  providerConfig: ProviderConfig | null,
): providerConfig is ProviderConfig {
  return (
    !!providerConfig &&
    isAPIProviderConfig(providerConfig) &&
    !isPureAPIProvider(providerConfig.provider) &&
    !providerConfig.apiKey
  )
}

/**
 * Renders next to a feature's label when the provider it runs on has no key yet, and nothing
 * otherwise — so callers can hand it whichever provider the feature resolved to.
 *
 * Both destinations open that provider in Provider Config rather than the page as a whole, so
 * the field to fill in is already on screen: the options app navigates in place, and the popup
 * opens the options page in a tab.
 */
export function SetApiKeyWarning({ providerConfig }: { providerConfig: ProviderConfig | null }) {
  const inRouterContext = useInRouterContext()

  if (!needsApiKeyWarning(providerConfig)) {
    return null
  }

  const route = buildProviderConfigRoute(providerConfig.id)
  const label = i18n.t("options.apiProviders.title")

  return (
    <div className="border-warning-border flex flex-wrap items-center gap-x-1 rounded-md border bg-warning px-2 text-xs">
      {i18n.t("options.setAPIKeyWarning.please")}{" "}
      {inRouterContext ? (
        <Link to={route} className={LINK_CLASS}>
          {label}
        </Link>
      ) : (
        <button
          type="button"
          className={LINK_CLASS}
          onClick={() => void openOptionsPage({ route })}
        >
          {label}
        </button>
      )}{" "}
      {i18n.t("options.setAPIKeyWarning.page")}
    </div>
  )
}
