import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { IconCheck, IconChevronRight, IconCircle } from '@tabler/icons-react'
import * as React from 'react'
import { cn } from '@/utils/styles/utils'
import {
  getFirefoxExtensionRoot,
  getIsFirefoxExtensionEnv,
  preventDismiss,
} from '../../utils/firefox/firefox-compat'
import { useFirefoxRadixOpenController } from '../../utils/firefox/firefox-radix'

const isFirefoxExtensionEnv = getIsFirefoxExtensionEnv()

interface FirefoxDropdownMenuContextValue {
  isFirefoxMode: boolean
  grantClosePermission: () => void
}

const FirefoxDropdownMenuContext = React.createContext<FirefoxDropdownMenuContextValue>({
  isFirefoxMode: false,
  grantClosePermission: () => {},
})

function useFirefoxDropdownContext(): FirefoxDropdownMenuContextValue {
  return React.use(FirefoxDropdownMenuContext)
}

function DropdownMenu({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  if (isFirefoxExtensionEnv)
    return <DropdownMenuFirefox {...props} />

  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuFirefox({
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  const {
    isFirefoxMode,
    rootOpen,
    rootDefaultOpen,
    handleOpenChange,
    grantClosePermission,
  } = useFirefoxRadixOpenController({
    controlledOpen,
    defaultOpen,
    onOpenChange,
    triggerSelectors: ['[data-slot="dropdown-menu-trigger"]', '[data-slot="dropdown-menu-sub-trigger"]'],
    interactiveSelectors: [
      '[data-slot="dropdown-menu-item"]',
      '[data-slot="dropdown-menu-checkbox-item"]',
      '[data-slot="dropdown-menu-radio-item"]',
    ],
    contentSelector: '[data-slot="dropdown-menu-content"], [data-slot="dropdown-menu-sub-content"]',
  })

  const contextValue = React.useMemo<FirefoxDropdownMenuContextValue>(() => (
    isFirefoxMode
      ? { isFirefoxMode: true, grantClosePermission }
      : { isFirefoxMode: false, grantClosePermission: () => {} }
  ), [grantClosePermission, isFirefoxMode])

  return (
    <DropdownMenuPrimitive.Root
      data-slot="dropdown-menu"
      open={rootOpen}
      defaultOpen={rootDefaultOpen}
      onOpenChange={handleOpenChange}
      {...props}
    >
      <FirefoxDropdownMenuContext value={contextValue}>
        {children}
      </FirefoxDropdownMenuContext>
    </DropdownMenuPrimitive.Root>
  )
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  )
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  )
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  container,
  disablePortal = false,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content> & {
  container?: HTMLElement | null
  disablePortal?: boolean
}) {
  if (isFirefoxExtensionEnv) {
    return (
      <DropdownMenuContentFirefox
        className={className}
        sideOffset={sideOffset}
        container={container}
        disablePortal={disablePortal}
        {...props}
      />
    )
  }

  const content = (
    <DropdownMenuPrimitive.Content
      data-slot="dropdown-menu-content"
      sideOffset={sideOffset}
      className={cn(
        'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md',
        className,
      )}
      {...props}
    />
  )

  if (disablePortal)
    return content

  return (
    <DropdownMenuPrimitive.Portal container={container ?? undefined}>
      {content}
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = 'default',
  onSelect,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
  variant?: 'default' | 'destructive'
}) {
  if (isFirefoxExtensionEnv) {
    return (
      <DropdownMenuItemFirefox
        className={className}
        inset={inset}
        variant={variant}
        onSelect={onSelect}
        {...props}
      />
    )
  }

  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        'focus:bg-ghost focus:text-ghost-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*=\'text-\'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4',
        className,
      )}
      onSelect={onSelect}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  onSelect,
  onCheckedChange,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  if (isFirefoxExtensionEnv) {
    return (
      <DropdownMenuCheckboxItemFirefox
        className={className}
        checked={checked}
        onSelect={onSelect}
        onCheckedChange={onCheckedChange}
        {...props}
      >
        {children}
      </DropdownMenuCheckboxItemFirefox>
    )
  }

  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        'focus:bg-ghost focus:text-ghost-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4',
        className,
      )}
      checked={checked}
      onSelect={onSelect}
      onCheckedChange={onCheckedChange}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <IconCheck className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  onSelect,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  if (isFirefoxExtensionEnv) {
    return (
      <DropdownMenuRadioItemFirefox
        className={className}
        onSelect={onSelect}
        {...props}
      >
        {children}
      </DropdownMenuRadioItemFirefox>
    )
  }

  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        'focus:bg-ghost focus:text-ghost-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4',
        className,
      )}
      onSelect={onSelect}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <IconCircle className="size-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        'px-2 py-1.5 text-sm font-medium data-[inset]:pl-8',
        className,
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn('bg-border -mx-1 my-1 h-px', className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        'text-muted-foreground ml-auto text-xs tracking-widest',
        className,
      )}
      {...props}
    />
  )
}

function DropdownMenuSub({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  onSelect,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean
}) {
  if (isFirefoxExtensionEnv) {
    return (
      <DropdownMenuSubTriggerFirefox
        className={className}
        inset={inset}
        onSelect={onSelect}
        {...props}
      >
        {children}
      </DropdownMenuSubTriggerFirefox>
    )
  }

  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        'focus:bg-ghost focus:text-ghost-foreground data-[state=open]:bg-ghost data-[state=open]:text-ghost-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8',
        className,
      )}
      onSelect={onSelect}
      {...props}
    >
      {children}
      <IconChevronRight className="ml-auto size-4" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

function DropdownMenuSubContent({
  className,
  container,
  disablePortal,
  onPointerDownOutside,
  hideWhenDetached,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent> & {
  container?: HTMLElement | null
  disablePortal?: boolean
}) {
  if (isFirefoxExtensionEnv) {
    return (
      <DropdownMenuSubContentFirefox
        className={className}
        container={container}
        disablePortal={disablePortal}
        onPointerDownOutside={onPointerDownOutside}
        hideWhenDetached={hideWhenDetached}
        {...props}
      />
    )
  }

  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg',
        className,
      )}
      onPointerDownOutside={onPointerDownOutside}
      hideWhenDetached={hideWhenDetached}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
}

function DropdownMenuContentFirefox({
  className,
  sideOffset = 4,
  container,
  disablePortal = false,
  onCloseAutoFocus,
  onPointerDownOutside,
  onFocusOutside,
  onInteractOutside,
  collisionBoundary,
  hideWhenDetached,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content> & {
  container?: HTMLElement | null
  disablePortal?: boolean
}) {
  const pointerDownOutsideHandler = React.useMemo(() => {
    return (event: Event) => {
      preventDismiss(event)
      onPointerDownOutside?.(event as any)
    }
  }, [onPointerDownOutside])

  const closeAutoFocusHandler = React.useMemo(() => {
    return (event: Event) => {
      preventDismiss(event)
      onCloseAutoFocus?.(event as any)
    }
  }, [onCloseAutoFocus])

  const focusOutsideHandler = React.useMemo(() => {
    return (event: Event) => {
      preventDismiss(event)
      onFocusOutside?.(event as any)
    }
  }, [onFocusOutside])

  const interactOutsideHandler = React.useMemo(() => {
    return (event: Event) => {
      preventDismiss(event)
      onInteractOutside?.(event as any)
    }
  }, [onInteractOutside])

  const isInShadowDOM = React.useMemo(() => {
    if (typeof document === 'undefined')
      return false

    let node: Node | null = document.activeElement
    while (node) {
      if (node instanceof ShadowRoot)
        return true
      node = (node as any).parentNode || (node as any).host || null
    }

    return false
  }, [])

  const firefoxRoot = React.useMemo(() => getFirefoxExtensionRoot() ?? undefined, [])

  const finalCollisionBoundary = (isFirefoxExtensionEnv && isInShadowDOM)
    ? (collisionBoundary ?? firefoxRoot)
    : collisionBoundary

  const finalDisablePortal = (isFirefoxExtensionEnv && isInShadowDOM) ? true : disablePortal
  const finalContainer = container ?? (isFirefoxExtensionEnv ? firefoxRoot : undefined)
  const finalHideWhenDetached = isFirefoxExtensionEnv ? true : hideWhenDetached

  const content = (
    <DropdownMenuPrimitive.Content
      data-slot="dropdown-menu-content"
      sideOffset={sideOffset}
      className={cn(
        'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-[2147483647] max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md',
        className,
      )}
      onPointerDownOutside={pointerDownOutsideHandler}
      onCloseAutoFocus={closeAutoFocusHandler}
      onFocusOutside={focusOutsideHandler}
      onInteractOutside={interactOutsideHandler}
      collisionBoundary={finalCollisionBoundary}
      hideWhenDetached={finalHideWhenDetached}
      {...props}
    />
  )

  if (finalDisablePortal)
    return content

  return (
    <DropdownMenuPrimitive.Portal container={finalContainer}>
      {content}
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuItemFirefox({
  className,
  inset,
  variant = 'default',
  onSelect,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
  variant?: 'default' | 'destructive'
}) {
  const { isFirefoxMode, grantClosePermission } = useFirefoxDropdownContext()

  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        'focus:bg-ghost focus:text-ghost-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*=\'text-\'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4',
        className,
      )}
      onSelect={(event) => {
        if (isFirefoxMode)
          grantClosePermission()
        onSelect?.(event)
      }}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItemFirefox({
  className,
  children,
  checked,
  onSelect,
  onCheckedChange,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  const { isFirefoxMode, grantClosePermission } = useFirefoxDropdownContext()

  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        'focus:bg-ghost focus:text-ghost-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4',
        className,
      )}
      checked={checked}
      onSelect={(event) => {
        if (isFirefoxMode)
          grantClosePermission()
        onSelect?.(event)
      }}
      onCheckedChange={(value) => {
        if (isFirefoxMode)
          grantClosePermission()
        onCheckedChange?.(value)
      }}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <IconCheck className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioItemFirefox({
  className,
  children,
  onSelect,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  const { isFirefoxMode, grantClosePermission } = useFirefoxDropdownContext()

  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        'focus:bg-ghost focus:text-ghost-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4',
        className,
      )}
      onSelect={(event) => {
        if (isFirefoxMode)
          grantClosePermission()
        onSelect?.(event)
      }}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <IconCircle className="size-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

function DropdownMenuSubTriggerFirefox({
  className,
  inset,
  children,
  onSelect,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean
}) {
  const { isFirefoxMode, grantClosePermission } = useFirefoxDropdownContext()

  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        'focus:bg-ghost focus:text-ghost-foreground data-[state=open]:bg-ghost data-[state=open]:text-ghost-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8',
        className,
      )}
      onSelect={(event) => {
        if (isFirefoxMode)
          grantClosePermission()
        onSelect?.(event)
      }}
      {...props}
    >
      {children}
      <IconChevronRight className="ml-auto size-4" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

function DropdownMenuSubContentFirefox({
  className,
  container,
  disablePortal = false,
  onPointerDownOutside,
  hideWhenDetached,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent> & {
  container?: HTMLElement | null
  disablePortal?: boolean
}) {
  const pointerDownOutsideHandler = React.useMemo(() => {
    return (event: Event) => {
      preventDismiss(event)
      onPointerDownOutside?.(event as any)
    }
  }, [onPointerDownOutside])

  const firefoxRoot = React.useMemo(() => getFirefoxExtensionRoot() ?? undefined, [])
  const finalHideWhenDetached = isFirefoxExtensionEnv ? true : hideWhenDetached
  const finalContainer = container ?? (isFirefoxExtensionEnv ? firefoxRoot : undefined)

  const content = (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-[2147483647] min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg',
        className,
      )}
      onPointerDownOutside={pointerDownOutsideHandler}
      hideWhenDetached={finalHideWhenDetached}
      {...props}
    />
  )

  if (disablePortal)
    return content

  return (
    <DropdownMenuPrimitive.Portal container={finalContainer}>
      {content}
    </DropdownMenuPrimitive.Portal>
  )
}
