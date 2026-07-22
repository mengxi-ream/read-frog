import type { ComponentProps, ReactElement } from "react"
import { Toast } from "@base-ui/react/toast"
import {
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  LoaderCircleIcon,
  type LucideIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { buttonVariants } from "@/components/ui/base-ui/button"
import { cn } from "@/utils/styles/utils"

const TOAST_ICONS = {
  error: CircleAlertIcon,
  info: InfoIcon,
  loading: LoaderCircleIcon,
  success: CircleCheckIcon,
  warning: TriangleAlertIcon,
} as const

type SwipeDirection = "up" | "down" | "left" | "right"

type ToastData = {
  rootProps?: Omit<
    ComponentProps<typeof Toast.Root>,
    "children" | "className" | "swipeDirection" | "toast"
  >
  tooltipStyle?: boolean
}

export type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"

function getSwipeDirection(position: ToastPosition): SwipeDirection[] {
  const verticalDirection: SwipeDirection = position.startsWith("top") ? "up" : "down"

  if (position.includes("center")) {
    return [verticalDirection]
  }

  if (position.includes("left")) {
    return ["left", verticalDirection]
  }

  return ["right", verticalDirection]
}

function getUpsertReplayClassName(toast: {
  type?: string
  updateKey?: number
}): string | undefined {
  const updateKey = toast.updateKey ?? 0
  if (updateKey <= 0) return undefined

  const isEven = updateKey % 2 === 0
  if (toast.type === "error") {
    return isEven ? "animate-toast-error-even" : "animate-toast-error-odd"
  }

  return isEven ? "animate-toast-success-even" : "animate-toast-success-odd"
}

function FullToastContent({
  Icon,
  toast,
  stacked = false,
}: {
  Icon: LucideIcon | null
  toast: Toast.Root.ToastObject
  stacked?: boolean
}): ReactElement {
  return (
    <Toast.Content
      className={cn(
        "pointer-events-auto flex min-w-0 items-center justify-between gap-1.5 overflow-hidden px-3.5 py-3 text-sm",
        stacked &&
          "transition-opacity duration-250 data-behind:opacity-0 data-behind:not-data-expanded:pointer-events-none data-expanded:opacity-100",
      )}
      data-slot="toast-content"
    >
      <div className="flex min-w-0 flex-1 gap-2">
        {Icon ? (
          <div
            className="shrink-0 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&>svg]:h-lh [&>svg]:w-4"
            data-slot="toast-icon"
          >
            <Icon className="in-data-[type=error]:text-destructive in-data-[type=info]:text-toast-info in-data-[type=loading]:animate-spin in-data-[type=loading]:opacity-80 in-data-[type=success]:text-toast-success in-data-[type=warning]:text-toast-warning" />
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Toast.Title className="font-medium [overflow-wrap:anywhere]" data-slot="toast-title" />
          <Toast.Description
            className="[overflow-wrap:anywhere] text-muted-foreground"
            data-slot="toast-description"
          />
        </div>
      </div>
      {toast.actionProps ? (
        <Toast.Action
          className={cn("shrink-0", buttonVariants({ size: "xs" }))}
          data-slot="toast-action"
        >
          {toast.actionProps.children}
        </Toast.Action>
      ) : null}
    </Toast.Content>
  )
}

function Toasts({
  position,
  portalProps,
  viewportProps,
}: {
  position: ToastPosition
  portalProps?: ComponentProps<typeof Toast.Portal>
  viewportProps?: Omit<ComponentProps<typeof Toast.Viewport>, "children">
}): ReactElement {
  const { toasts } = Toast.useToastManager()
  const swipeDirection = getSwipeDirection(position)
  const { className: viewportClassName, ...restViewportProps } = viewportProps ?? {}

  return (
    <Toast.Portal data-slot="toast-portal" {...portalProps}>
      <Toast.Viewport
        {...restViewportProps}
        data-position={position}
        data-slot="toast-viewport"
        className={cn(
          "notranslate fixed z-[2147483647] mx-auto flex w-[calc(100%-var(--toast-inset)*2)] max-w-90 font-sans antialiased [--toast-inset:--spacing(4)] sm:[--toast-inset:--spacing(8)]",
          "data-[position*=top]:top-(--toast-inset)",
          "data-[position*=bottom]:bottom-(--toast-inset)",
          "data-[position*=left]:left-(--toast-inset)",
          "data-[position*=right]:right-(--toast-inset)",
          "data-[position*=center]:left-1/2 data-[position*=center]:-translate-x-1/2",
          viewportClassName,
        )}
      >
        {toasts.map((toast) => {
          const Icon = toast.type ? TOAST_ICONS[toast.type as keyof typeof TOAST_ICONS] : null
          const toastData = toast.data as ToastData | undefined

          return (
            <Toast.Root
              key={toast.id}
              className={cn(
                "absolute z-[calc(9999-var(--toast-index))] h-(--toast-calc-height) w-full rounded-lg border bg-[color-mix(in_srgb,var(--rf-popover),var(--color-black)_calc(1%*max(0,var(--toast-index,0))))] text-popover-foreground shadow-lg/5 select-none [transition:transform_.5s_cubic-bezier(.22,1,.36,1),opacity_.5s,height_.15s,background-color_.5s] not-dark:bg-clip-padding before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] data-expanded:bg-popover dark:bg-[color-mix(in_srgb,var(--rf-popover),var(--color-black)_calc(6%*max(0,var(--toast-index,0))))] dark:before:shadow-[0_-1px_--theme(--color-white/6%)] dark:data-expanded:bg-popover",
                "data-[position*=right]:right-0 data-[position*=right]:left-auto",
                "data-[position*=left]:right-auto data-[position*=left]:left-0",
                "data-[position*=center]:right-0 data-[position*=center]:left-0",
                "data-[position*=top]:top-0 data-[position*=top]:bottom-auto data-[position*=top]:origin-[50%_calc(50%-50%*min(var(--toast-index,0),1))]",
                "data-[position*=bottom]:top-auto data-[position*=bottom]:bottom-0 data-[position*=bottom]:origin-[50%_calc(50%+50%*min(var(--toast-index,0),1))]",
                "after:absolute after:left-0 after:h-[calc(var(--toast-gap)+1px)] after:w-full",
                "data-[position*=top]:after:top-full",
                "data-[position*=bottom]:after:bottom-full",
                "[--toast-calc-height:var(--toast-frontmost-height,var(--toast-height))] [--toast-gap:--spacing(3)] [--toast-peek:--spacing(3)] [--toast-scale:calc(max(0,1-(var(--toast-index)*.1)))] [--toast-shrink:calc(1-var(--toast-scale))]",
                "data-[position*=top]:[--toast-calc-offset-y:calc(var(--toast-offset-y)+var(--toast-index)*var(--toast-gap)+var(--toast-swipe-movement-y))]",
                "data-[position*=bottom]:[--toast-calc-offset-y:calc(var(--toast-offset-y)*-1+var(--toast-index)*var(--toast-gap)*-1+var(--toast-swipe-movement-y))]",
                "data-[position*=top]:transform-[translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)+(var(--toast-index)*var(--toast-peek))+(var(--toast-shrink)*var(--toast-calc-height))))_scale(var(--toast-scale))]",
                "data-[position*=bottom]:transform-[translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--toast-peek))-(var(--toast-shrink)*var(--toast-calc-height))))_scale(var(--toast-scale))]",
                "data-limited:opacity-0",
                "data-expanded:h-(--toast-height)",
                "data-position:data-expanded:transform-[translateX(var(--toast-swipe-movement-x))_translateY(var(--toast-calc-offset-y))]",
                "data-[position*=top]:data-starting-style:transform-[translateY(calc(-100%-var(--toast-inset)))]",
                "data-[position*=bottom]:data-starting-style:transform-[translateY(calc(100%+var(--toast-inset)))]",
                "data-ending-style:opacity-0",
                "data-ending-style:not-data-limited:not-data-swipe-direction:transform-[translateY(calc(100%+var(--toast-inset)))]",
                "data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)-100%-var(--toast-inset)))_translateY(var(--toast-calc-offset-y))]",
                "data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)+100%+var(--toast-inset)))_translateY(var(--toast-calc-offset-y))]",
                "data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-100%-var(--toast-inset)))]",
                "data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)+100%+var(--toast-inset)))]",
                "data-expanded:data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)-100%-var(--toast-inset)))_translateY(var(--toast-calc-offset-y))]",
                "data-expanded:data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)+100%+var(--toast-inset)))_translateY(var(--toast-calc-offset-y))]",
                "data-expanded:data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-100%-var(--toast-inset)))]",
                "data-expanded:data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)+100%+var(--toast-inset)))]",
                getUpsertReplayClassName(toast),
              )}
              {...toastData?.rootProps}
              data-position={position}
              swipeDirection={swipeDirection}
              toast={toast}
            >
              <FullToastContent Icon={Icon} stacked toast={toast} />
            </Toast.Root>
          )
        })}
      </Toast.Viewport>
    </Toast.Portal>
  )
}

function AnchoredToasts({
  portalProps,
}: {
  portalProps?: ComponentProps<typeof Toast.Portal>
}): ReactElement {
  const { toasts } = Toast.useToastManager()

  return (
    <Toast.Portal data-slot="toast-portal-anchored" {...portalProps}>
      <Toast.Viewport
        className="notranslate font-sans antialiased outline-none"
        data-slot="toast-viewport-anchored"
      >
        {toasts.map((toast) => {
          const Icon = toast.type ? TOAST_ICONS[toast.type as keyof typeof TOAST_ICONS] : null
          const toastData = toast.data as ToastData | undefined
          const tooltipStyle = toastData?.tooltipStyle ?? false
          const anchor = toast.positionerProps?.anchor

          if (!anchor?.isConnected) return null

          return (
            <Toast.Positioner
              key={toast.id}
              className="pointer-events-none z-[2147483647] max-w-[min(22.5rem,var(--available-width))] data-anchor-hidden:invisible"
              data-slot="toast-positioner"
              sideOffset={toast.positionerProps?.sideOffset ?? 4}
              toast={toast}
            >
              <Toast.Root
                className={cn(
                  "relative max-w-full border bg-[var(--rf-popover)] text-xs text-balance text-popover-foreground shadow-lg/5 transition-[scale,opacity] select-none not-dark:bg-clip-padding before:pointer-events-none before:absolute before:inset-0 before:shadow-[0_1px_--theme(--color-black/4%)] data-ending-style:scale-98 data-ending-style:opacity-0 data-starting-style:scale-98 data-starting-style:opacity-0 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
                  tooltipStyle
                    ? "rounded-md shadow-md/5 before:rounded-[calc(var(--radius-md)-1px)]"
                    : "rounded-lg before:rounded-[calc(var(--radius-lg)-1px)]",
                  getUpsertReplayClassName(toast),
                )}
                {...toastData?.rootProps}
                data-slot="toast-popup"
                toast={toast}
              >
                {tooltipStyle ? (
                  <Toast.Content
                    className="pointer-events-auto min-w-0 px-2 py-1 [overflow-wrap:anywhere]"
                    data-slot="toast-content"
                  >
                    <Toast.Title data-slot="toast-title" />
                  </Toast.Content>
                ) : (
                  <FullToastContent Icon={Icon} toast={toast} />
                )}
              </Toast.Root>
            </Toast.Positioner>
          )
        })}
      </Toast.Viewport>
    </Toast.Portal>
  )
}

export const toastManager: ReturnType<typeof Toast.createToastManager> = Toast.createToastManager()

export const anchoredToastManager: ReturnType<typeof Toast.createToastManager> =
  Toast.createToastManager()

const DEFAULT_TOAST_TIMEOUT = 5000
const DEFAULT_ANCHORED_TOAST_TIMEOUT = 3000

export interface ToastProviderProps extends Toast.Provider.Props {
  position?: ToastPosition
  portalProps?: ComponentProps<typeof Toast.Portal>
  viewportProps?: Omit<ComponentProps<typeof Toast.Viewport>, "children">
}

export function ToastProvider({
  children,
  position = "bottom-right",
  portalProps,
  timeout = DEFAULT_TOAST_TIMEOUT,
  viewportProps,
  ...props
}: ToastProviderProps): ReactElement {
  return (
    <Toast.Provider toastManager={toastManager} timeout={timeout} {...props}>
      {children}
      <Toasts position={position} portalProps={portalProps} viewportProps={viewportProps} />
    </Toast.Provider>
  )
}

export interface AnchoredToastProviderProps extends Toast.Provider.Props {
  portalProps?: ComponentProps<typeof Toast.Portal>
}

export function AnchoredToastProvider({
  children,
  portalProps,
  timeout = DEFAULT_ANCHORED_TOAST_TIMEOUT,
  ...props
}: AnchoredToastProviderProps): ReactElement {
  return (
    <Toast.Provider toastManager={anchoredToastManager} timeout={timeout} {...props}>
      {children}
      <AnchoredToasts portalProps={portalProps} />
    </Toast.Provider>
  )
}

export { Toast as ToastPrimitive }
