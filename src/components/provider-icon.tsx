export default function ProviderIcon({ logo, name, className }: { logo: string, name?: string, className?: string }) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className="size-5 rounded-full bg-white border border-border flex items-center justify-center">
        <img
          src={logo}
          alt={name}
          className="size-[11px]"
        />
      </div>
      {name && <span>{name}</span>}
    </div>
  )
}
