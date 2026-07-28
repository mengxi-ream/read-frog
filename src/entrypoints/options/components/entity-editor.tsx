import { cn } from "@/utils/styles/utils"

function Root({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col justify-between rounded-xl border bg-card p-4",
        className,
      )}
    >
      {children}
    </div>
  )
}

function Body({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-4", className)}>{children}</div>
}

function Footer({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mt-8 flex justify-between", className)}>{children}</div>
}

function Empty({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-[420px] flex-1 items-center justify-center rounded-xl border bg-card p-4 text-sm text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  )
}

export const EntityEditor = {
  Root,
  Body,
  Footer,
  Empty,
}
