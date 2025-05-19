export function ConfigCard({ title, description, children, className }: { title: React.ReactNode, description: React.ReactNode, children: React.ReactNode, className?: string }) {
  return (
    <section className={cn('py-6 flex lg:flex-row flex-col lg:gap-x-[50px] xl:gap-x-[100px] gap-y-4', className)}>
      <div className="lg:basis-2/5">
        <h2 className="text-md font-bold mb-1">{title}</h2>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <div className="lg:mt-0 lg:basis-3/5">
        {children}
      </div>
    </section>
  )
}
