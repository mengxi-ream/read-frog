import type { ProviderConfig } from "@/types/config/provider"
import { i18n } from "#imports"
import { IconAspectRatio, IconRefresh } from "@tabler/icons-react"
import { useCallback } from "react"
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
import { SelectionPopover, useSelectionPopoverOverlayProps } from "@/components/ui/selection-popover"
import { cn } from "@/utils/styles/utils"
import {
  SelectionPopoverTooltip,
  useSelectionTooltipState,
} from "./selection-tooltip"

function PreviewField({
  field,
  label,
  value,
}: {
  field: "title" | "paragraphs"
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
          className="max-h-36 overflow-y-auto rounded-md border bg-muted/40 px-2 py-1 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-muted-foreground"
        >
          {displayValue}
        </div>
      </FieldContent>
    </Field>
  )
}

export function ContextDetailsButton({
  className,
  paragraphsText,
  titleText,
}: {
  className?: string
  paragraphsText: string | null | undefined
  titleText: string | null | undefined
}) {
  const popoverOverlay = useSelectionPopoverOverlayProps()
  const buttonLabel = i18n.t("action.viewContextDetails")
  const { handlePress, onOpenChange: handleTooltipOpenChange, open: tooltipOpen } = useSelectionTooltipState()

  const handleClick = useCallback(() => {
    handlePress()
  }, [handlePress])

  return (
    <Popover>
      <SelectionPopoverTooltip
        content={buttonLabel}
        open={tooltipOpen}
        onOpenChange={handleTooltipOpenChange}
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
      </SelectionPopoverTooltip>
      <PopoverContent
        container={popoverOverlay.container}
        positionerClassName={popoverOverlay.positionerClassName}
        side="top"
        align="end"
        className="w-80 max-w-[calc(100vw-2rem)] p-3"
      >
        <FieldGroup className="gap-3">
          <PreviewField field="title" label={i18n.t("action.contextDetailsTitleLabel")} value={titleText} />
          <PreviewField field="paragraphs" label={i18n.t("action.contextDetailsParagraphsLabel")} value={paragraphsText} />
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
  const { handlePress, onOpenChange: handleTooltipOpenChange, open: tooltipOpen } = useSelectionTooltipState()

  const handleClick = useCallback(() => {
    handlePress()
    onRegenerate()
  }, [handlePress, onRegenerate])

  return (
    <SelectionPopoverTooltip
      content={i18n.t("action.regenerate")}
      open={tooltipOpen}
      onOpenChange={handleTooltipOpenChange}
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
    </SelectionPopoverTooltip>
  )
}

export function SelectionToolbarFooterContent({
  children,
  className,
  paragraphsText,
  onProviderChange,
  onRegenerate,
  providers,
  titleText,
  value,
}: {
  children?: React.ReactNode
  className?: string
  paragraphsText: string | null | undefined
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
        {children}
        <ContextDetailsButton titleText={titleText} paragraphsText={paragraphsText} />
        <RegenerateButton onRegenerate={onRegenerate} />
      </div>
    </SelectionPopover.Footer>
  )
}
