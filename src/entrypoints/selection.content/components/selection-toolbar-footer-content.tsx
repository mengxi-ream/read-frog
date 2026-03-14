import type { ProviderConfig } from "@/types/config/provider"
import { i18n } from "#imports"
import { IconAspectRatio, IconRefresh } from "@tabler/icons-react"
import { useCallback, useState } from "react"
import ProviderSelector from "@/components/llm-providers/provider-selector"
import { buttonVariants } from "@/components/ui/base-ui/button"
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldTitle,
} from "@/components/ui/base-ui/field"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/base-ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { SelectionPopover, useSelectionPopoverOverlayProps } from "@/components/ui/selection-popover"
import { cn } from "@/utils/styles/utils"

const TOOLTIP_TRIGGER_PRESS_REASON = "trigger-press"

function PreviewField({
  field,
  label,
  value,
}: {
  field: "title" | "context"
  label: string
  value: string | null | undefined
}) {
  const displayValue = value?.trim() ? value : "—"

  return (
    <Field>
      <FieldContent>
        <FieldTitle>{label}</FieldTitle>
        <div
          data-slot="selection-toolbar-footer-preview-value"
          data-field={field}
          className="max-h-36 overflow-y-auto rounded-md border bg-muted/40 px-2 py-1 text-sm whitespace-pre-wrap wrap-break-words text-muted-foreground"
        >
          {displayValue}
        </div>
      </FieldContent>
    </Field>
  )
}

export function ContextDetailsButton({
  className,
  contextText,
  titleText,
}: {
  className?: string
  contextText: string | null | undefined
  titleText: string | null | undefined
}) {
  const popoverOverlay = useSelectionPopoverOverlayProps()
  const buttonLabel = i18n.t("action.viewContextDetails")
  const [tooltipOpen, setTooltipOpen] = useState(false)

  const handleClick = useCallback(() => {
    setTooltipOpen(true)
  }, [])

  const handleTooltipOpenChange = useCallback((nextOpen: boolean, eventDetails: { reason: string }) => {
    if (!nextOpen && eventDetails.reason === TOOLTIP_TRIGGER_PRESS_REASON) {
      return
    }

    setTooltipOpen(nextOpen)
  }, [])

  return (
    <Popover>
      <Tooltip open={tooltipOpen} onOpenChange={handleTooltipOpenChange}>
        <TooltipTrigger
          render={(
            <PopoverTrigger
              render={(
                <button
                  type="button"
                  className={cn(buttonVariants({ variant: "ghost-secondary", size: "icon-sm" }), className)}
                  onClick={handleClick}
                  aria-label={buttonLabel}
                  title={buttonLabel}
                />
              )}
            />
          )}
        >
          <IconAspectRatio />
        </TooltipTrigger>
        <TooltipContent
          className="whitespace-nowrap"
          container={popoverOverlay.container}
          positionerClassName={popoverOverlay.positionerClassName}
        >
          {buttonLabel}
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        container={popoverOverlay.container}
        positionerClassName={popoverOverlay.positionerClassName}
        side="top"
        align="end"
        className="w-80 max-w-[calc(100vw-2rem)] p-3"
      >
        <FieldGroup className="gap-3">
          <PreviewField field="title" label={i18n.t("action.contextDetailsTitleLabel")} value={titleText} />
          <PreviewField field="context" label={i18n.t("action.contextDetailsContextLabel")} value={contextText} />
        </FieldGroup>
      </PopoverContent>
    </Popover>
  )
}

export function RegenerateButton({
  className,
  onRegenerate,
}: {
  className?: string
  onRegenerate: () => void
}) {
  const popoverOverlay = useSelectionPopoverOverlayProps()
  const [tooltipOpen, setTooltipOpen] = useState(false)

  const handleClick = useCallback(() => {
    setTooltipOpen(true)
    onRegenerate()
  }, [onRegenerate])

  const handleTooltipOpenChange = useCallback((nextOpen: boolean, eventDetails: { reason: string }) => {
    if (!nextOpen && eventDetails.reason === TOOLTIP_TRIGGER_PRESS_REASON) {
      return
    }

    setTooltipOpen(nextOpen)
  }, [])

  return (
    <Tooltip open={tooltipOpen} onOpenChange={handleTooltipOpenChange}>
      <TooltipTrigger
        render={(
          <button
            type="button"
            className={cn(buttonVariants({ variant: "ghost-secondary", size: "icon-sm" }), className)}
            onClick={handleClick}
            aria-label={i18n.t("action.regenerate")}
            title={i18n.t("action.regenerate")}
          />
        )}
      >
        <IconRefresh />
      </TooltipTrigger>
      <TooltipContent
        className="whitespace-nowrap"
        container={popoverOverlay.container}
        positionerClassName={popoverOverlay.positionerClassName}
      >
        {i18n.t("action.regenerate")}
      </TooltipContent>
    </Tooltip>
  )
}

export function SelectionToolbarFooterContent({
  className,
  contextText,
  onProviderChange,
  onRegenerate,
  providers,
  titleText,
  value,
}: {
  className?: string
  contextText: string | null | undefined
  onProviderChange: (id: string) => void
  onRegenerate: () => void
  providers: ProviderConfig[]
  titleText: string | null | undefined
  value: string
}) {
  const popoverOverlay = useSelectionPopoverOverlayProps()

  return (
    <SelectionPopover.Footer className={cn("justify-between gap-3 border-t", className)}>
      <div className="min-w-0 max-w-52 flex-1">
        <ProviderSelector
          providers={providers}
          value={value}
          onChange={onProviderChange}
          className="max-w-60"
          selectContentProps={popoverOverlay}
        />
      </div>
      <div className="flex items-center gap-1">
        <ContextDetailsButton titleText={titleText} contextText={contextText} />
        <RegenerateButton onRegenerate={onRegenerate} />
      </div>
    </SelectionPopover.Footer>
  )
}
