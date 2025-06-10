'use client'

import type { MotionValue } from 'motion/react'
import { motion, useScroll, useTransform } from 'motion/react'
import React, { useRef } from 'react'

export function ContainerScroll({
  titleComponent,
  children,
}: {
  titleComponent: string | React.ReactNode
  children: React.ReactNode
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end end'],
  })
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => {
      window.removeEventListener('resize', checkMobile)
    }
  }, [])

  const scaleDimensions = () => {
    return isMobile ? [0.7, 0.9] : [1.05, 1]
  }

  const rotate = useTransform(scrollYProgress, [0, 0.85], [40, 0])
  const scale = useTransform(scrollYProgress, [0, 1], scaleDimensions())
  const translate = useTransform(scrollYProgress, [0, 1], [0, -100])

  return (
    <div
      className="mt-20 flex items-center justify-center relative p-2 md:p-20"
      ref={containerRef}
    >
      <div
        className="pt-10 w-full relative"
        style={{
          perspective: '1000px',
        }}
      >
        <Header translate={translate} titleComponent={titleComponent} />
        <Card rotate={rotate} translate={translate} scale={scale}>
          {children}
        </Card>
      </div>
    </div>
  )
}

export function Header({
  translate,
  titleComponent,
}: {
  translate: MotionValue<number>
  titleComponent: React.ReactNode
}) {
  return (
    <motion.div
      style={{
        translateY: translate,
      }}
      className="div max-w-5xl mx-auto text-center"
    >
      {titleComponent}
    </motion.div>
  )
}

export function Card({
  rotate,
  scale,
  children,
}: {
  rotate: MotionValue<number>
  scale: MotionValue<number>
  translate: MotionValue<number>
  children: React.ReactNode
}) {
  return (
    <motion.div
      style={{
        rotateX: rotate,
        scale,
        boxShadow:
          '0 0 #0000002d, 0 6px 15px #0000002a, 0 25px 25px #00000022, 0 60px 35px #00000016, 0 100px 40px #00000008, 0 160px 45px #00000002',
      }}
      className="max-w-5xl -mt-12 mx-auto w-full border-4 border-[#6C6C6C] p-2 md:p-6 bg-[#222222] rounded-[30px] shadow-2xl"
    >
      <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-gray-100 dark:bg-zinc-900 md:rounded-2xl">
        {children}
      </div>
    </motion.div>
  )
}
