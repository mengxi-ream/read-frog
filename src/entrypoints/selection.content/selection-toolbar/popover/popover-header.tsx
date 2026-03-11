import { Icon } from "@iconify/react"
import { IconGripHorizontal, IconX } from "@tabler/icons-react"
import { POPOVER_DRAG_HANDLE_CLASS } from "./use-popover-layout"

interface PopoverHeaderProps {
  title: string
  icon: React.ReactNode | string
  isDragging: boolean
  onClose: () => void
}

export function PopoverHeader({ title, icon, isDragging, onClose }: PopoverHeaderProps) {
  return (
    <div
      className={`group relative flex items-center justify-between border-b p-4 select-none ${POPOVER_DRAG_HANDLE_CLASS} hover:cursor-grab active:cursor-grabbing`}
    >
      <div
        className={`absolute left-1/2 top-0 -translate-x-1/2 p-1 transition-all duration-200 ${isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        style={{
          color: isDragging ? "var(--read-frog-primary)" : undefined,
        }}
      >
        <IconGripHorizontal className="size-4" />
      </div>

      <div className="flex items-center gap-2">
        {typeof icon === "string"
          ? (
              <Icon icon={icon} strokeWidth={0.8} className="size-4.5 text-zinc-600 dark:text-zinc-400" />
            )
          : (
              icon
            )}
        <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-100">{title}</h2>
      </div>
      <button
        type="button"
        data-rf-no-drag="true"
        onClick={onClose}
        className="rounded p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700"
      >
        <IconX strokeWidth={1} className="size-4 text-zinc-600 dark:text-zinc-400" />
      </button>
    </div>
  )
}
