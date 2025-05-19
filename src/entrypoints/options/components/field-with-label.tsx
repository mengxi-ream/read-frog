export function FieldWithLabel({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={label} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  )
}
