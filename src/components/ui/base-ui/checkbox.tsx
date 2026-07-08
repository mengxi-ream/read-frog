import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { IconCheck } from "@tabler/icons-react"
import * as React from "react"
import { cn } from "@/utils/styles/utils"

type CheckboxProps = Omit<CheckboxPrimitive.Root.Props, "onCheckedChange"> & {
  /**
   * Callback fired when the checked state changes.
   * API compatible with old Radix-based shadcn Checkbox.
   */
  onCheckedChange?: (checked: boolean) => void
}

function Checkbox({ className, onCheckedChange, ...props }: CheckboxProps) {
  const handleCheckedChange = React.useCallback(
    (checked: boolean, _eventDetails: unknown) => {
      onCheckedChange?.(checked)
    },
    [onCheckedChange],
  )

  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input shadow-xs transition-shadow outline-none group-has-disabled/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary",
        className,
      )}
      onCheckedChange={handleCheckedChange}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        <IconCheck />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
