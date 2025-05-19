import Container from '@/components/container'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'

export function PageLayout({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="w-full pb-8">
      <Container className="max-w-7xl border-b">
        <header className="flex h-14 -ml-1.5 shrink-0 items-center gap-2">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-1.5 h-4!" />
          <h1>{title}</h1>
        </header>
      </Container>
      {children}
    </div>
  )
}
