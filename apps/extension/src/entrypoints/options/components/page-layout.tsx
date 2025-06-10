import Container from '@/components/container'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'

export function PageLayout({ title, children, className, innerClassName }: { title: string, children: React.ReactNode, className?: string, innerClassName?: string }) {
  return (
    <div className={cn('w-full', className)}>
      <div className="border-b">
        <Container>
          <header className="flex h-14 -ml-1.5 shrink-0 items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-1.5 h-4!" />
            <h1>{title}</h1>
          </header>
        </Container>
      </div>
      <Container className={innerClassName}>
        {children}
      </Container>
    </div>
  )
}
