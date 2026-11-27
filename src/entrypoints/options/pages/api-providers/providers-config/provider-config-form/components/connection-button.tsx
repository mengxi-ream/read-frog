import type { APIProviderConfig } from "@/types/config/provider"
import { IconCheck, IconHourglassLow, IconX } from "@tabler/icons-react"
import { useMutation } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"
import LoadingDots from "@/components/loading-dots"
import { Button } from "@/components/ui/base-ui/button"
import { getObjectWithoutAPIKeys } from "@/utils/config/api"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { executeTranslate } from "@/utils/host/translate/execute-translate"
import { i18n } from "@/utils/i18n"
import { getTranslatePrompt } from "@/utils/prompts/translate"
import { getProviderConnectionURL } from "@/utils/providers/connection-url"

const SLOW_CONNECTION_THRESHOLD_MS = 3_000
const CONNECTION_TEST_FEEDBACK_DURATION_MS = 5_000

type ConnectionTestFeedback = "success" | "failed" | "slow"

interface ConnectionTestInputs {
  provider: APIProviderConfig["provider"]
  apiKey: string | undefined
  connectionURL: string | undefined
  providerSpecificSettings: unknown
}

interface ConnectionTestVariables {
  requestId: number
  startedAt: number
}

const connectionTestFeedbackIconConfig = {
  success: {
    Icon: IconCheck,
    containerClassName: "flex size-4 items-center justify-center rounded-full bg-success/15",
    iconClassName: "size-3 text-success stroke-[2.5]",
  },
  failed: {
    Icon: IconX,
    containerClassName: "flex size-4 items-center justify-center rounded-full bg-destructive/15",
    iconClassName: "size-3 text-destructive stroke-[2.5]",
  },
  slow: {
    Icon: IconHourglassLow,
    containerClassName: "flex size-4 items-center justify-center rounded-full bg-warning/15",
    iconClassName: "size-3 text-warning stroke-[2.5]",
  },
} satisfies Record<
  ConnectionTestFeedback,
  {
    Icon: typeof IconCheck
    containerClassName: string
    iconClassName: string
  }
>

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

function getConnectionTestInputs(providerConfig: APIProviderConfig): ConnectionTestInputs {
  return {
    provider: providerConfig.provider,
    apiKey: providerConfig.apiKey,
    connectionURL: getProviderConnectionURL(providerConfig),
    providerSpecificSettings:
      "providerSpecificSettings" in providerConfig
        ? providerConfig.providerSpecificSettings
        : undefined,
  }
}

function isSameConnectionTestInputs(a: ConnectionTestInputs, b: ConnectionTestInputs) {
  return (
    a.provider === b.provider &&
    a.apiKey === b.apiKey &&
    a.connectionURL === b.connectionURL &&
    a.providerSpecificSettings === b.providerSpecificSettings
  )
}

export function ConnectionTestButton({ providerConfig }: { providerConfig: APIProviderConfig }) {
  // A test result only describes the settings it ran with. When any of them changes, remount the
  // button so the old result, its timer and its in-flight request are dropped together.
  const inputs = getConnectionTestInputs(providerConfig)
  const [seenInputs, setSeenInputs] = useState(inputs)
  const [generation, setGeneration] = useState(0)
  if (!isSameConnectionTestInputs(seenInputs, inputs)) {
    setSeenInputs(inputs)
    setGeneration((current) => current + 1)
  }

  return <ConnectionTestButtonBody key={generation} providerConfig={providerConfig} />
}

function ConnectionTestButtonBody({ providerConfig }: { providerConfig: APIProviderConfig }) {
  const { apiKey, provider } = providerConfig
  const [feedback, setFeedback] = useState<ConnectionTestFeedback | null>(null)
  const latestRequestIdRef = useRef(0)
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mutation = useMutation({
    // for safety, we should not include apiKey in the mutationKey
    mutationKey: ["apiConnection", getObjectWithoutAPIKeys(providerConfig)],
    mutationFn: async (_variables: ConnectionTestVariables) => {
      return await executeTranslate(
        "Hi",
        DEFAULT_CONFIG.language,
        providerConfig,
        getTranslatePrompt,
      )
    },
  })

  const clearFeedbackTimeout = useCallback(() => {
    if (feedbackTimeoutRef.current !== null) {
      clearTimeout(feedbackTimeoutRef.current)
      feedbackTimeoutRef.current = null
    }
  }, [])

  const showFeedback = useCallback(
    (nextFeedback: ConnectionTestFeedback, requestId: number) => {
      if (requestId !== latestRequestIdRef.current) {
        return
      }

      clearFeedbackTimeout()
      setFeedback(nextFeedback)
      feedbackTimeoutRef.current = setTimeout(() => {
        if (requestId === latestRequestIdRef.current) {
          setFeedback(null)
        }
        feedbackTimeoutRef.current = null
      }, CONNECTION_TEST_FEEDBACK_DURATION_MS)
    },
    [clearFeedbackTimeout],
  )

  const handleTestConnection = () => {
    clearFeedbackTimeout()
    setFeedback(null)

    const requestId = latestRequestIdRef.current + 1
    latestRequestIdRef.current = requestId
    const startedAt = Date.now()

    mutation.mutate(
      { requestId, startedAt },
      {
        onSuccess: (_data, variables) => {
          showFeedback(getConnectionTestFeedback(variables.startedAt), variables.requestId)
        },
        onError: (_error, variables) => {
          showFeedback("failed", variables.requestId)
        },
      },
    )
  }

  useEffect(() => {
    return () => {
      latestRequestIdRef.current += 1
      clearFeedbackTimeout()
    }
  }, [clearFeedbackTimeout])

  return (
    <Button
      size="xs"
      variant="outline"
      className="gap-2"
      onClick={handleTestConnection}
      disabled={mutation.isPending || (!apiKey && provider !== "deeplx" && provider !== "ollama")}
    >
      {mutation.isPending ? (
        <>
          <LoadingDots className="scale-75" />
          <span className="shimmer text-xs">
            {i18n.t("options.apiProviders.testConnection.testing")}
          </span>
        </>
      ) : feedback ? (
        <>
          <ConnectionFeedbackIcon feedback={feedback} />
          <span className="text-xs">{i18n.t(connectionTestFeedbackLabelKey[feedback])}</span>
        </>
      ) : (
        <span className="text-xs">{i18n.t("options.apiProviders.testConnection.button")}</span>
      )}
    </Button>
  )
}
