"use client"

import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"
import * as React from "react"
import { SHARED_POPUP_CLOSED_STATE_CLASS } from "@/components/ui/base-ui/popup-animation-classes"
import { cn } from "@/utils/styles/utils"

function Drawer({ ...props }: DrawerPrimitive.Root.Props) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />
}

function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerPortal({ ...props }: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerOverlay({
  className,
  ...props
}: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/10 opacity-[calc(1-var(--drawer-swipe-progress))] transition-opacity duration-[500ms] ease-[cubic-bezier(0.32,0.72,0,1)] supports-backdrop-filter:backdrop-blur-xs data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-swiping:duration-0",
        SHARED_POPUP_CLOSED_STATE_CLASS,
        className,
      )}
      {...props}
    />
  )
}

function DrawerViewport({
  className,
  ...props
}: DrawerPrimitive.Viewport.Props) {
  return (
    <DrawerPrimitive.Viewport
      data-slot="drawer-viewport"
      className={cn("fixed inset-0 z-50 flex touch-none items-end justify-center", className)}
      {...props}
    />
  )
}

function DrawerContent({
  container,
  className,
  children,
  ...props
}: DrawerPrimitive.Popup.Props
  & Pick<DrawerPrimitive.Portal.Props, "container">) {
  return (
    <DrawerPortal container={container}>
      <DrawerOverlay />
      <DrawerViewport>
        <DrawerPrimitive.Popup
          data-slot="drawer-content"
          className={cn(
            "group/drawer-content fixed z-50 flex h-auto touch-none flex-col bg-popover text-sm text-popover-foreground outline-none transition-[transform,opacity] duration-[500ms] ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-swiping:duration-0",
            "data-[swipe-direction=down]:inset-x-0 data-[swipe-direction=down]:bottom-0 data-[swipe-direction=down]:mt-24 data-[swipe-direction=down]:max-h-[80vh] data-[swipe-direction=down]:rounded-t-xl data-[swipe-direction=down]:border-t",
            "data-[swipe-direction=up]:inset-x-0 data-[swipe-direction=up]:top-0 data-[swipe-direction=up]:mb-24 data-[swipe-direction=up]:max-h-[80vh] data-[swipe-direction=up]:rounded-b-xl data-[swipe-direction=up]:border-b",
            "data-[swipe-direction=left]:inset-y-0 data-[swipe-direction=left]:left-0 data-[swipe-direction=left]:w-3/4 data-[swipe-direction=left]:rounded-r-xl data-[swipe-direction=left]:border-r data-[swipe-direction=left]:sm:max-w-sm",
            "data-[swipe-direction=right]:inset-y-0 data-[swipe-direction=right]:right-0 data-[swipe-direction=right]:w-3/4 data-[swipe-direction=right]:rounded-l-xl data-[swipe-direction=right]:border-l data-[swipe-direction=right]:sm:max-w-sm",
            "data-[swipe-direction=down]:[transform:translate3d(0,calc(var(--drawer-snap-point-offset)+var(--drawer-swipe-movement-y)),0)] data-[swipe-direction=up]:[transform:translate3d(0,calc(var(--drawer-snap-point-offset)+var(--drawer-swipe-movement-y)),0)]",
            "data-[swipe-direction=left]:[transform:translate3d(var(--drawer-swipe-movement-x),0,0)] data-[swipe-direction=right]:[transform:translate3d(var(--drawer-swipe-movement-x),0,0)]",
            "data-starting-style:data-[swipe-direction=down]:[transform:translate3d(0,100%,0)] data-ending-style:data-[swipe-direction=down]:[transform:translate3d(0,100%,0)]",
            "data-starting-style:data-[swipe-direction=up]:[transform:translate3d(0,-100%,0)] data-ending-style:data-[swipe-direction=up]:[transform:translate3d(0,-100%,0)]",
            "data-starting-style:data-[swipe-direction=left]:[transform:translate3d(-100%,0,0)] data-ending-style:data-[swipe-direction=left]:[transform:translate3d(-100%,0,0)]",
            "data-starting-style:data-[swipe-direction=right]:[transform:translate3d(100%,0,0)] data-ending-style:data-[swipe-direction=right]:[transform:translate3d(100%,0,0)]",
            "after:pointer-events-none after:absolute after:bg-inherit after:content-[''] data-[swipe-direction=down]:after:inset-x-0 data-[swipe-direction=down]:after:top-full data-[swipe-direction=down]:after:h-[200%]",
            "data-[swipe-direction=up]:after:inset-x-0 data-[swipe-direction=up]:after:bottom-full data-[swipe-direction=up]:after:h-[200%]",
            "data-[swipe-direction=left]:after:inset-y-0 data-[swipe-direction=left]:after:right-full data-[swipe-direction=left]:after:w-[200%]",
            "data-[swipe-direction=right]:after:inset-y-0 data-[swipe-direction=right]:after:left-full data-[swipe-direction=right]:after:w-[200%]",
            SHARED_POPUP_CLOSED_STATE_CLASS,
            className,
          )}
          {...props}
        >
          <div className="mx-auto mt-4 hidden h-1.5 w-[100px] shrink-0 rounded-full bg-muted group-data-[swipe-direction=down]/drawer-content:block" />
          {children}
        </DrawerPrimitive.Popup>
      </DrawerViewport>
    </DrawerPortal>
  )
}

function DrawerBody({
  className,
  ...props
}: DrawerPrimitive.Content.Props) {
  return (
    <DrawerPrimitive.Content
      data-slot="drawer-body"
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain touch-auto",
        className,
      )}
      {...props}
    />
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "flex flex-col gap-0.5 p-4 group-data-[swipe-direction=down]/drawer-content:text-center group-data-[swipe-direction=up]/drawer-content:text-center md:gap-1.5 md:text-left",
        className,
      )}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("cn-font-heading font-medium text-foreground", className)}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
}
