import Image from 'next/image'
import { Container } from '@/components/container'
import { getLobeIconsCDNUrlFn } from '@/utils/logo'

export function ClientLogos() {
  return (
    <section>
      <Container className="grid grid-rows-2 md:grid-rows-1 grid-cols-2 md:grid-cols-4 gap-y-10 flex-wrap w-full justify-between items-center py-12 md:py-12 md:px-20 place-items-center">
        <PlainLogos />
        <CompanyLogos />
      </Container>
    </section>
  )
}

function PlainLogos() {
  return (
    <>
      <ClientLogo src="icons/PKU.svg" alt="PKU" />
      <ClientLogo src="icons/THU.svg" alt="THU" />
    </>
  )
}

function CompanyLogos() {
  const companiesLogoList = [
    { src: getLobeIconsCDNUrlFn('Alibaba-color')(), alt: 'Alibaba' },
    { src: getLobeIconsCDNUrlFn('ByteDance-color')(), alt: 'ByteDance' },
  ]

  return (
    <>
      {companiesLogoList.map(logo => (
        <ClientLogo key={logo.alt} {...logo} />
      ))}
    </>
  )
}

function ClientLogo({ src, alt }: { src: string, alt: string }) {
  const size = 48

  return (
    <Image
      className="hover:scale-110 ease-in-out transition-transform duration-100"
      src={src}
      alt={alt}
      width={size}
      height={size}
    />
  )
}
