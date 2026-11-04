import type { MissingApiKeyState } from "./missing-api-key"
import { IconInfoCircle, IconKey } from "@tabler/icons-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/base-ui/alert"
import { Button } from "@/components/ui/base-ui/button"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"
import { buildProviderConfigRoute } from "@/utils/navigation"

function openProviderApiKey(providerId: string) {
  // Content scripts cannot open the options page themselves — route through the background.
  void sendMessage("openOptionsPage", {
    route: buildProviderConfigRoute(providerId, { highlightApiKey: true }),
  })
}

/**
 * Says why an action's own provider did not answer: it has no API key. Either
 * the Built-in AI answered instead (a quiet note above the answer), or it could
 * not either (an alert in place of the answer, with both ways out).
 */
export function MissingApiKeyNotice({ state }: { state: MissingApiKeyState | null }) {
  if (!state) {
    return null
  }

  const addApiKeyLabel = i18n.t("options.selectionToolbar.missingApiKey.addApiKey")

  if (state.kind === "fallback") {
    return (
      <div className="px-4 pt-3">
        <p
          role="status"
          data-slot="missing-api-key-fallback-notice"
          className="flex items-start gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground"
        >
          <IconInfoCircle className="mt-px size-3.5 shrink-0" />
          <span className="min-w-0 break-words">
            {i18n.t("options.selectionToolbar.missingApiKey.fallbackNotice", [state.providerName])}{" "}
            <button
              type="button"
              className="cursor-pointer text-link hover:underline"
              onClick={() => openProviderApiKey(state.providerId)}
            >
              {addApiKeyLabel}
            </button>
          </span>
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 pb-4">
      <Alert variant="warning" data-slot="missing-api-key-blocked">
        <IconKey className="size-4" />
        <AlertTitle>
          {i18n.t("options.selectionToolbar.missingApiKey.title", [state.providerName])}
        </AlertTitle>
        <AlertDescription className="col-start-2">
          <p>{i18n.t("options.selectionToolbar.missingApiKey.description")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => openProviderApiKey(state.providerId)}>
              {addApiKeyLabel}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void sendMessage("openPage", { url: state.builtInAiAction.url, active: true })
              }
            >
              {state.builtInAiAction.label}
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )
}
