import { cn } from '@repo/ui/lib/utils'
import Image from 'next/image'
import { Container } from '@/components/container'

const logoList = [
  { src: '/icons/pku.png', alt: 'PKU', invertColor: true },
  { src: '/icons/thu.png', alt: 'THU', invertColor: true },
  { src: '/icons/bytedance.svg', alt: 'ByteDance' },
  { src: '/icons/alibaba.png', alt: 'Alibaba' },
]

export function ClientLogos() {
  return (
    <section>
      <Container className="grid grid-rows-2 md:grid-rows-1 grid-cols-2 md:grid-cols-4 flex-wrap w-full justify-between items-center md:px-20 place-items-center mb-8">
        {logoList.map(({ src, alt, invertColor }) => (
          <Image
            key={alt}
            className={cn(
              'hover:scale-110 ease-in-out transition-transform duration-100',
              invertColor && 'dark:brightness-0 dark:invert-100',
            )}
            src={src}
            alt={alt}
            height={128}
            width={128}
          />
        ))}
      </Container>
    </section>
  )
}
