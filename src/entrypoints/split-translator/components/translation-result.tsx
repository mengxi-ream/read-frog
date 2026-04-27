import type { SplitTextTranslationState } from "../hooks/use-split-text-translation"
import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/base-ui/alert"
import { Button } from "@/components/ui/base-ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/base-ui/card"
import { CopyResultButton } from "./copy-result-button"

export function TranslationResult({
  onRetry,
  state,
}: {
  onRetry: () => void
  state: SplitTextTranslationState
}) {
  const liveRegionProps = {
    "role": "status" as const,
    "aria-live": "polite" as const,
    "aria-busy": state.status === "loading",
  }

  if (state.status === "idle") {
    return (
      <Card {...liveRegionProps}>
        <CardHeader>
          <CardTitle>{i18n.t("splitTranslator.resultTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {i18n.t("splitTranslator.emptyResult")}
        </CardContent>
      </Card>
    )
  }

  if (state.status === "loading") {
    return (
      <Card {...liveRegionProps}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="tabler:loader-2" className="size-4 animate-spin" />
            {i18n.t("splitTranslator.translating")}
          </CardTitle>
        </CardHeader>
      </Card>
    )
  }

  if (state.status === "error") {
    return (
      <Alert variant="destructive">
        <AlertTitle>{i18n.t("splitTranslator.translationFailed")}</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{state.error}</p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            {i18n.t("splitTranslator.retry")}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Card {...liveRegionProps}>
      <CardHeader>
        <CardTitle>{i18n.t("splitTranslator.resultTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="whitespace-pre-wrap text-base leading-relaxed">
          {state.result}
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <CopyResultButton text={state.result} />
      </CardFooter>
    </Card>
  )
}
