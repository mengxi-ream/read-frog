'use client'

import { useIsMobile } from '@repo/ui/hooks/use-mobile'
import { cn } from '@repo/ui/lib/utils'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from '@/components/icons'
import { MacBrowserShell } from '@/components/mac-browser-shell'

interface DemoItem {
  type: string
  duration: number
  content: React.ReactNode
}

const DEMO_LIST: DemoItem[] = [
  {
    type: 'translation',
    duration: 5000,
    content: <TranslationDemo />,
  },
  {
    type: 'read',
    duration: 5000,
    content: <ReadDemo />,
  },
]

export function Demo() {
  const [currentStep, setCurrentStep] = useState(0)
  const [autoPlaying, setAutoPlaying] = useState(true)

  useEffect(() => {
    if (!autoPlaying)
      return

    const currentDemo = DEMO_LIST[currentStep]

    if (!currentDemo)
      return

    const { duration } = currentDemo

    const timeout = setTimeout(() => {
      const nextStep = (currentStep + 1) % DEMO_LIST.length
      setCurrentStep(nextStep)
    }, duration)

    return () => clearTimeout(timeout)
  }, [autoPlaying, currentStep])

  const handleMouseEnter = () => setAutoPlaying(false)
  const handleMouseLeave = () => setAutoPlaying(true)

  const switchDemo = (targetStep: number) => {
    const nextStep = (targetStep + DEMO_LIST.length) % DEMO_LIST.length
    setCurrentStep(nextStep)
    setAutoPlaying(false)
  }

  return (
    <section
      className="flex justify-center min-h-[90vh] bg-zinc-50 dark:bg-zinc-900 overflow-hidden pt-8"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="w-full flex flex-col gap-4 md:gap-8 items-center overflow-hidden px-4">
        <MacBrowserShell
          url="https://readfrog.app"
          className="mx-auto flex-auto max-w-4xl md:w-6xl h-full"
        >
          <AnimatePresence>
            <motion.div
              key={currentStep}
              initial={{
                opacity: 0.4,
                scaleX: 0.9,
                y: 50,
              }}
              animate={{
                opacity: 1,
                scaleX: 1,
                y: 0,
              }}
              transition={{
                duration: 0.3,
              }}
              className="w-full h-full"
            >
              {DEMO_LIST[currentStep]?.content}
            </motion.div>
          </AnimatePresence>
        </MacBrowserShell>
        <SwitchBanner currentStep={currentStep} switchDemo={switchDemo} />
      </div>
    </section>
  )
}

function SwitchBanner({ currentStep, switchDemo }: { currentStep: number, switchDemo: (nextStep: number) => void }) {
  const isMobile = useIsMobile()

  const currentDemo = DEMO_LIST[currentStep]

  if (!currentDemo)
    return null

  return isMobile
    ? (
        <div className="grid grid-flow-col w-full col-span items-center justify-between">
          <ChevronLeft className="col-span-1" onClick={() => switchDemo(currentStep - 1)} />
          <DemoSwitchButton className="row-span-full w-full" demo={currentDemo} focus />
          <ChevronRight className="col-span-1" onClick={() => switchDemo(currentStep + 1)} />
        </div>
      )
    : (
        <ul className="flex w-full items-center justify-center border-y border-zinc-100 dark:border-zinc-900 overflow-hidden">
          {DEMO_LIST.map((demo, demoIndex) => (
            <DemoSwitchButton key={demo.type} demo={demo} focus={currentStep === demoIndex} onClick={() => switchDemo(demoIndex)} />
          ))}
        </ul>
      )
}

function DemoSwitchButton({ demo, focus, className, onClick }: { demo: DemoItem, focus: boolean, className?: string, onClick?: () => void }) {
  return (
    <motion.li
      className={cn('flex justify-center items-center h-full cursor-pointer relative flex-1', className)}
      onClick={onClick}
    >
      <motion.div
        className="h-16 md:h-20 w-full p-3 md:p-4 relative z-10 flex flex-col items-center justify-center gap-1 md:gap-2"
        animate={{
          backgroundColor: focus ? 'bg-primary' : 'bg-zinc-100 dark:bg-zinc-900',
        }}
        transition={{ duration: 0.2 }}
      >

        {/* {focus && (
          <motion.div
            layoutId="activeTab"
            className="absolute inset-0 bg-white dark:bg-zinc-800 shadow-sm"
            initial={false}
            transition={{
              type: 'spring',
              stiffness: 500,
              damping: 30,
            }}
          />
        )} */}

        {focus && (
          <motion.div
            layoutId="underline"
            className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 md:w-16 h-0.5 bg-primary rounded-full"
            initial={false}
            transition={{
              type: 'spring',
              stiffness: 500,
              damping: 30,
            }}
          />
        )}

        <span className="relative z-20 font-medium capitalize text-sm md:text-base">
          {demo.type}
        </span>
      </motion.div>
    </motion.li>
  )
}

function TranslationDemo() {
  return (
    <div className="p-8 text-center w-full h-full">
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Vitae at odit fugiat, perferendis voluptas aliquid totam, dignissimos ex consequuntur ad ipsum natus eveniet optio, veniam praesentium repellat quae quos repellendus.
    </div>
  )
}

function ReadDemo() {
  return (
    <div className="p-8 text-center w-full h-full">
      Lorem ipsum dolor sit amet consectetur adipisicing elit. Vitae at odit fugiat, perferendis voluptas aliquid totam, dignissimos ex consequuntur ad ipsum natus eveniet optio, veniam praesentium repellat quae quos repellendus.
    </div>
  )
}
