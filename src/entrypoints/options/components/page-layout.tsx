import Container from '@/components/container'
import { Separator } from '@/components/shadcn/separator'
import { SidebarTrigger } from '@/components/shadcn/sidebar'
import { cn } from '@/utils/styles/utils'

export function PageLayout({ title, children, className, innerClassName }: { title: React.ReactNode, children: React.ReactNode, className?: string, innerClassName?: string }) {
  return (
    <div className={cn('w-full pb-8', className)}>
      <div className="border-b">
        <Container>
          <header className="flex h-14 -ml-1.5 shrink-0 items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-1.5 h-4!" />
            <h1>{title}</h1>
          </header>
        </Container>
      </div>
      <Container className={cn('@container', innerClassName)}>
        {children}
      </Container>
    </div>
  )
}
