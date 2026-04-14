import type { JSONValue } from "ai"
import { i18n } from "#imports"
import { Icon } from "@iconify/react"
import { dequal } from "dequal"
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/base-ui/popover"
import { JSONCodeEditor } from "@/components/ui/json-code-editor"
import { getRecommendedProviderOptionsMatch } from "@/utils/providers/options"
import { cn } from "@/utils/styles/utils"

interface ProviderOptionsRecommendationTriggerProps {
  providerId: string
  modelId?: string | null
  currentProviderOptions?: Record<string, JSONValue>
  onApply: (options: Record<string, JSONValue>) => void
}

const FLASH_DURATION_MS = 1400

export function ProviderOptionsRecommendationTrigger({
  providerId,
  modelId,
  currentProviderOptions,
  onApply,
}: ProviderOptionsRecommendationTriggerProps) {
  const [open, setOpen] = useState(false)
  const [isFlashing, setIsFlashing] = useState(false)
  const hasMountedRef = useRef(false)
  const previousProviderIdRef = useRef(providerId)
  const previousMatchIndexRef = useRef<number | undefined>(undefined)

  const closePopover = useEffectEvent(() => {
    // eslint-disable-next-line react/set-state-in-effect
    setOpen(false)
  })

  const startFlashing = useEffectEvent(() => {
    // eslint-disable-next-line react/set-state-in-effect
    setIsFlashing(true)
  })

  const stopFlashing = useEffectEvent(() => {
    // eslint-disable-next-line react/set-state-in-effect
    setIsFlashing(false)
  })

  const recommendation = useMemo(() => {
    if (!modelId?.trim()) {
      return undefined
    }
    return getRecommendedProviderOptionsMatch(modelId.trim())
  }, [modelId])

  const recommendationJson = useMemo(() => {
    if (!recommendation) {
      return ""
    }
    return JSON.stringify(recommendation.options, null, 2)
  }, [recommendation])

  const isApplied = useMemo(() => {
    if (!recommendation || !currentProviderOptions) {
      return false
    }
    return dequal(currentProviderOptions, recommendation.options)
  }, [currentProviderOptions, recommendation])

  useEffect(() => {
    if (!recommendation) {
      closePopover()
    }
  }, [recommendation])

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      previousProviderIdRef.current = providerId
      previousMatchIndexRef.current = recommendation?.matchIndex
      return
    }

    if (previousProviderIdRef.current !== providerId) {
      previousProviderIdRef.current = providerId
      previousMatchIndexRef.current = recommendation?.matchIndex
      stopFlashing()
      return
    }

    if (previousMatchIndexRef.current !== recommendation?.matchIndex) {
      previousMatchIndexRef.current = recommendation?.matchIndex

      if (recommendation) {
        startFlashing()
        const timeoutId = window.setTimeout(() => {
          setIsFlashing(false)
        }, FLASH_DURATION_MS)

        return () => {
          window.clearTimeout(timeoutId)
        }
      }

      stopFlashing()
    }
  }, [providerId, recommendation])

  if (!recommendation) {
    return null
  }

  const handleApply = () => {
    onApply(recommendation.options)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={(
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={i18n.t("options.apiProviders.form.providerOptionsRecommendationTrigger")}
            className={cn(
              "text-muted-foreground hover:text-foreground transition-colors duration-700 ease-in-out",
              isFlashing && "text-primary",
            )}
          />
        )}
      >
        <Icon icon="tabler:sparkles" className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-3">
        <PopoverHeader>
          <PopoverTitle>{i18n.t("options.apiProviders.form.providerOptionsRecommendationTitle")}</PopoverTitle>
          <PopoverDescription>{i18n.t("options.apiProviders.form.providerOptionsRecommendationDescription")}</PopoverDescription>
        </PopoverHeader>
        <JSONCodeEditor
          value={recommendationJson}
          editable={false}
          height="132px"
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant={isApplied ? "secondary" : "default"}
            disabled={isApplied}
            onClick={handleApply}
          >
            {isApplied
              ? i18n.t("options.apiProviders.form.providerOptionsRecommendationApplied")
              : i18n.t("options.apiProviders.form.providerOptionsRecommendationApply")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
