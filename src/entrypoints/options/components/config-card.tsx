export function ConfigCard({ title, description, children, className }: { title: string, description: string, children: React.ReactNode, className?: string }) {
  return (
    <section className={cn('py-6 border-b flex lg:flex-row flex-col', className)}>
      <div className="lg:w-2/5">
        <h2 className="text-md font-bold mb-1">{title}</h2>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <div className="mt-4 lg:mt-0 lg:w-3/5">
        {children}
      </div>
    </section>
  )
}
