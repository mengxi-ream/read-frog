import type { ComponentProps, ReactElement, ReactNode } from "react"
import { Toast } from "@base-ui/react/toast"
import {
  IconAlertOctagon,
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
  IconLoader,
  IconX,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/base-ui/button"
import { cn } from "@/utils/styles/utils"

// The design system's toast (`@repo/ui`'s toast.tsx: shadcn base-nova's toast on Base UI),
// behind the extension's own API: two managers, six corner positions, a portal container for
// shadow roots, and the replay animation when a stable id is upserted.

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

// Success, warning and error take their status colour; info and loading stay neutral.
function ToastIcon({ type }: { type: string | undefined }): ReactElement | null {
  let icon: ReactNode = null

  if (type === "success") icon = <IconCircleCheck className="text-success" aria-hidden="true" />
  if (type === "info") icon = <IconInfoCircle aria-hidden="true" />
  if (type === "warning") icon = <IconAlertTriangle className="text-warning" aria-hidden="true" />
  if (type === "error") icon = <IconAlertOctagon className="text-destructive" aria-hidden="true" />
  if (type === "loading") {
    icon = <IconLoader className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
  }

  if (!icon) return null

  return (
    <span
      data-slot="toast-icon"
      className="mt-0.5 shrink-0 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4"
    >
      {icon}
    </span>
  )
}

// Hoisted so the defaults below are one stable element, not a new one per render.
const ACTION_RENDER = <Button variant="outline" size="sm" />
const CLOSE_RENDER = <Button variant="ghost" size="icon-sm" />

function FullToastContent({
  toast,
  stacked = false,
}: {
  toast: Toast.Root.ToastObject
  stacked?: boolean
}): ReactElement {
  return (
    <Toast.Content
      data-slot="toast-content"
      className={cn(
        "flex h-full min-w-0 items-start gap-3 overflow-hidden p-4",
        stacked &&
          "transition-opacity duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] data-behind:opacity-0 data-behind:not-data-expanded:pointer-events-none data-expanded:opacity-100",
      )}
    >
      <ToastIcon type={toast.type} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Toast.Title
          data-slot="toast-title"
          className="text-sm font-medium [overflow-wrap:anywhere]"
        />
        <Toast.Description
          data-slot="toast-description"
          className="text-sm [overflow-wrap:anywhere] text-muted-foreground"
        />
      </div>
      {toast.actionProps ? (
        <Toast.Action data-slot="toast-action" render={ACTION_RENDER} className="-mt-1 shrink-0">
          {toast.actionProps.children}
        </Toast.Action>
      ) : null}
      <Toast.Close
        data-slot="toast-close"
        aria-label="Close toast"
        render={CLOSE_RENDER}
        className="relative -mt-1 shrink-0 text-muted-foreground after:absolute after:-inset-2 after:content-[''] hover:text-foreground"
      >
        <IconX aria-hidden="true" />
      </Toast.Close>
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
          "notranslate fixed z-[2147483647] mx-auto flex w-[calc(100%-var(--toast-inset)*2)] max-w-sm font-sans antialiased outline-none [--toast-inset:--spacing(4)]",
          "data-[position*=top]:top-(--toast-inset)",
          "data-[position*=bottom]:bottom-(--toast-inset)",
          "data-[position*=left]:left-(--toast-inset)",
          "data-[position*=right]:right-(--toast-inset)",
          "data-[position*=center]:left-1/2 data-[position*=center]:-translate-x-1/2",
          viewportClassName,
        )}
      >
        {toasts.map((toast) => {
          const toastData = toast.data as ToastData | undefined

          return (
            <Toast.Root
              key={toast.id}
              data-slot="toast"
              className={cn(
                "group/toast pointer-events-auto absolute z-[calc(9999-var(--toast-index))] h-(--toast-calc-height) w-full rounded-2xl border bg-popover text-popover-foreground shadow-md will-change-transform outline-none select-none [transition:transform_500ms_cubic-bezier(0.22,1,0.36,1),opacity_500ms,height_150ms] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none",
                "data-[position*=right]:right-0 data-[position*=right]:left-auto",
                "data-[position*=left]:right-auto data-[position*=left]:left-0",
                "data-[position*=center]:right-0 data-[position*=center]:left-0",
                "data-[position*=top]:top-0 data-[position*=top]:bottom-auto data-[position*=top]:origin-top",
                "data-[position*=bottom]:top-auto data-[position*=bottom]:bottom-0 data-[position*=bottom]:origin-bottom",
                "after:absolute after:left-0 after:h-[calc(var(--toast-gap)+1px)] after:w-full after:content-['']",
                "data-[position*=top]:after:top-full",
                "data-[position*=bottom]:after:bottom-full",
                "[--toast-calc-height:var(--toast-frontmost-height,var(--toast-height))] [--toast-gap:0.75rem] [--toast-peek:0.75rem] [--toast-scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--toast-shrink:calc(1-var(--toast-scale))]",
                "data-[position*=top]:[--toast-calc-offset-y:calc(var(--toast-offset-y)+var(--toast-index)*var(--toast-gap)+var(--toast-swipe-movement-y))]",
                "data-[position*=bottom]:[--toast-calc-offset-y:calc(var(--toast-offset-y)*-1+var(--toast-index)*var(--toast-gap)*-1+var(--toast-swipe-movement-y))]",
                "data-[position*=top]:transform-[translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)+(var(--toast-index)*var(--toast-peek))+(var(--toast-shrink)*var(--toast-calc-height))))_scale(var(--toast-scale))]",
                "data-[position*=bottom]:transform-[translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--toast-peek))-(var(--toast-shrink)*var(--toast-calc-height))))_scale(var(--toast-scale))]",
                "data-limited:opacity-0",
                "data-expanded:h-(--toast-height)",
                "data-position:data-expanded:transform-[translateX(var(--toast-swipe-movement-x))_translateY(var(--toast-calc-offset-y))]",
                "data-[position*=top]:data-starting-style:transform-[translateY(-150%)]",
                "data-[position*=bottom]:data-starting-style:transform-[translateY(150%)]",
                "data-[position*=top]:data-ending-style:not-data-limited:not-data-swipe-direction:transform-[translateY(-150%)]",
                "data-[position*=bottom]:data-ending-style:not-data-limited:not-data-swipe-direction:transform-[translateY(150%)]",
                "data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--toast-calc-offset-y))]",
                "data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--toast-calc-offset-y))]",
                "data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-150%))]",
                "data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)+150%))]",
                "data-expanded:data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--toast-calc-offset-y))]",
                "data-expanded:data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--toast-calc-offset-y))]",
                "data-expanded:data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-150%))]",
                "data-expanded:data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)+150%))]",
                getUpsertReplayClassName(toast),
              )}
              {...toastData?.rootProps}
              data-position={position}
              swipeDirection={swipeDirection}
              toast={toast}
            >
              <FullToastContent stacked toast={toast} />
            </Toast.Root>
          )
        })}
      </Toast.Viewport>
    </Toast.Portal>
  )
}

/**
 * Beside the control that raised it. `tooltipStyle` is the design system's anchored toast, a
 * small label (coss ui's, without the arrow); the full style carries the same content as a
 * corner toast, for a refusal that needs its icon and action next to the control. Both sit a
 * shadow step below the corner toasts' md: they rest right beside the control, and md's long
 * drop would darken whatever lies under them.
 */
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
          const toastData = toast.data as ToastData | undefined
          const tooltipStyle = toastData?.tooltipStyle ?? false
          const anchor = toast.positionerProps?.anchor

          // Without an anchor there is nothing to sit beside; Base UI would pin it to the
          // top-left corner of the page.
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
                  "pointer-events-auto relative max-w-full bg-popover text-popover-foreground shadow-sm transition-[scale,opacity] select-none data-ending-style:scale-98 data-ending-style:opacity-0 data-limited:opacity-0 data-starting-style:scale-98 data-starting-style:opacity-0 motion-reduce:transition-none",
                  tooltipStyle
                    ? "rounded-lg text-xs text-balance ring-1 ring-foreground/10"
                    : "rounded-2xl border",
                  getUpsertReplayClassName(toast),
                )}
                {...toastData?.rootProps}
                data-slot="toast-popup"
                toast={toast}
              >
                {tooltipStyle ? (
                  <Toast.Content
                    className="min-w-0 px-2 py-1 [overflow-wrap:anywhere]"
                    data-slot="toast-content"
                  >
                    <Toast.Title className="text-xs font-normal" data-slot="toast-title" />
                  </Toast.Content>
                ) : (
                  <FullToastContent toast={toast} />
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
