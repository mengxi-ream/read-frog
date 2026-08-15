import type { APIProviderTypes } from "@/types/config/provider"
import { Button } from "@/components/ui/base-ui/button"
import { PROVIDER_ITEMS } from "@/utils/constants/providers"
import { i18n } from "@/utils/i18n"

/** Renders nothing for providers without an `apiKeyUrl`, which is how the button stays opt-in. */
export function GetAPIKeyButton({ providerType }: { providerType: APIProviderTypes }) {
  const apiKeyUrl = PROVIDER_ITEMS[providerType].apiKeyUrl
  if (!apiKeyUrl) {
    return null
  }

  return (
    <Button
      size="xs"
      variant="brand-outline"
      render={<a href={apiKeyUrl} target="_blank" rel="noreferrer" />}
    >
      {i18n.t("options.apiProviders.apiKey.getAPIKey")}
    </Button>
  )
}
