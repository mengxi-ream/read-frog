import type { APIProviderConfig } from "@/types/config/provider"
import { IconCheck, IconHourglassLow, IconX } from "@tabler/icons-react"
import { useMutation } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"
import { i18n } from "#imports"
import LoadingDots from "@/components/loading-dots"
import { Button } from "@/components/ui/base-ui/button"
import { getObjectWithoutAPIKeys } from "@/utils/config/api"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { executeTranslate } from "@/utils/host/translate/execute-translate"
import { getTranslatePrompt } from "@/utils/prompts/translate"

const SLOW_CONNECTION_THRESHOLD_MS = 3_000
const CONNECTION_TEST_FEEDBACK_DURATION_MS = 5_000

type ConnectionTestFeedback = "success" | "failed" | "slow"

interface ConnectionTestFeedbackState {
  status: ConnectionTestFeedback
  requestId: number
  provider: APIProviderConfig["provider"]
  apiKey: string | undefined
  baseURL: string | undefined
  providerSpecificSettings: unknown
}

interface ConnectionTestVariables {
  requestId: number
  startedAt: number
}

const connectionTestFeedbackIconConfig = {
  success: {
    Icon: IconCheck,
    containerClassName: "flex size-4 items-center justify-center rounded-full bg-green-200 dark:bg-green-800/50",
    iconClassName: "size-3 text-green-700 dark:text-green-300 stroke-[2.5]",
  },
  failed: {
    Icon: IconX,
    containerClassName: "flex size-4 items-center justify-center rounded-full bg-red-200 dark:bg-red-800/50",
    iconClassName: "size-3 text-red-700 dark:text-red-300 stroke-[2.5]",
  },
  slow: {
    Icon: IconHourglassLow,
    containerClassName: "flex size-4 items-center justify-center rounded-full bg-yellow-200 dark:bg-yellow-800/50",
    iconClassName: "size-3 text-yellow-700 dark:text-yellow-300 stroke-[2.5]",
  },
} satisfies Record<ConnectionTestFeedback, {
  Icon: typeof IconCheck
  containerClassName: string
  iconClassName: string
}>

const connectionTestFeedbackLabelKey = {
  success: "options.apiProviders.testConnection.success",
  failed: "options.apiProviders.testConnection.failed",
  slow: "options.apiProviders.testConnection.slow",
} as const

function getConnectionTestFeedback(startedAt: number): ConnectionTestFeedback {
  return Date.now() - startedAt > SLOW_CONNECTION_THRESHOLD_MS ? "slow" : "success"
}

function ConnectionFeedbackIcon({ feedback }: { feedback: ConnectionTestFeedback }) {
  const {
    Icon: FeedbackIcon,
    containerClassName,
    iconClassName,
  } = connectionTestFeedbackIconConfig[feedback]

  return (
    <div aria-hidden="true" className={containerClassName}>
      <FeedbackIcon className={iconClassName} strokeWidth={2.5} />
    </div>
  )
}

export function ConnectionTestButton({ providerConfig }: { providerConfig: APIProviderConfig }) {
  const { apiKey, provider } = providerConfig
  const baseURL = "baseURL" in providerConfig ? providerConfig.baseURL : undefined
  const providerSpecificSettings = "providerSpecificSettings" in providerConfig
    ? providerConfig.providerSpecificSettings
    : undefined
  const [feedback, setFeedback] = useState<ConnectionTestFeedbackState | null>(null)
  const latestRequestIdRef = useRef(0)
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mutation = useMutation({
    // for safety, we should not include apiKey in the mutationKey
    mutationKey: ["apiConnection", getObjectWithoutAPIKeys(providerConfig)],
    mutationFn: async (_variables: ConnectionTestVariables) => {
      return await executeTranslate("Hi", DEFAULT_CONFIG.language, providerConfig, getTranslatePrompt)
    },
  })

  const clearFeedbackTimeout = useCallback(() => {
    if (feedbackTimeoutRef.current !== null) {
      clearTimeout(feedbackTimeoutRef.current)
      feedbackTimeoutRef.current = null
    }
  }, [])

  const showFeedback = useCallback((nextFeedback: ConnectionTestFeedback, requestId: number) => {
    if (requestId !== latestRequestIdRef.current) {
      return
    }

    clearFeedbackTimeout()
    setFeedback({
      status: nextFeedback,
      requestId,
      provider,
      apiKey,
      baseURL,
      providerSpecificSettings,
    })
    feedbackTimeoutRef.current = setTimeout(() => {
      if (requestId === latestRequestIdRef.current) {
        setFeedback(currentFeedback => currentFeedback?.requestId === requestId ? null : currentFeedback)
      }
      feedbackTimeoutRef.current = null
    }, CONNECTION_TEST_FEEDBACK_DURATION_MS)
  }, [apiKey, baseURL, clearFeedbackTimeout, provider, providerSpecificSettings])

  const handleTestConnection = () => {
    clearFeedbackTimeout()
    setFeedback(null)

    const requestId = latestRequestIdRef.current + 1
    latestRequestIdRef.current = requestId
    const startedAt = Date.now()

    mutation.mutate({ requestId, startedAt }, {
      onSuccess: (_data, variables) => {
        showFeedback(getConnectionTestFeedback(variables.startedAt), variables.requestId)
      },
      onError: (_error, variables) => {
        showFeedback("failed", variables.requestId)
      },
    })
  }

  useEffect(() => {
    latestRequestIdRef.current += 1
    clearFeedbackTimeout()
    mutation.reset()
  // eslint-disable-next-line react/exhaustive-deps
  }, [provider, apiKey, baseURL, providerSpecificSettings, clearFeedbackTimeout])

  useEffect(() => {
    return () => {
      latestRequestIdRef.current += 1
      clearFeedbackTimeout()
    }
  }, [clearFeedbackTimeout])

  const visibleFeedback = feedback
    && feedback.requestId === latestRequestIdRef.current
    && feedback.provider === provider
    && feedback.apiKey === apiKey
    && feedback.baseURL === baseURL
    && feedback.providerSpecificSettings === providerSpecificSettings
    ? feedback.status
    : null

  return (
    <Button
      size="xs"
      variant="outline"
      className="gap-2"
      onClick={handleTestConnection}
      disabled={mutation.isPending || (!apiKey && provider !== "deeplx" && provider !== "ollama")}
    >
      {mutation.isPending
        ? (
            <>
              <LoadingDots className="scale-75" />
              <span className="text-xs">
                {i18n.t("options.apiProviders.testConnection.testing")}
              </span>
            </>
          )
        : visibleFeedback
          ? (
              <>
                <ConnectionFeedbackIcon feedback={visibleFeedback} />
                <span className="text-xs">
                  {i18n.t(connectionTestFeedbackLabelKey[visibleFeedback])}
                </span>
              </>
            )
          : (
              <span className="text-xs">
                {i18n.t("options.apiProviders.testConnection.button")}
              </span>
            )}
    </Button>
  )
}
