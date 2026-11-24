import type { ReactNode } from "react"

/**
 * One kind of quota inside the usage card. A sub-heading rather than a
 * ConfigSection: the card already frames the page, and a second rule-and-title
 * per group would box the bars in twice. The id is what `?section=` and the
 * command palette scroll to.
 */
export function UsageGroup({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm leading-5 font-medium">{title}</h3>
        {description && (
          <p className="text-[13px] leading-[18px] text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}

/** A line standing in for the bars: signed out, no plan, or the request failed. */
export function UsageNotice({ children }: { children: ReactNode }) {
  return <p className="text-[13px] leading-[18px] text-muted-foreground">{children}</p>
}
