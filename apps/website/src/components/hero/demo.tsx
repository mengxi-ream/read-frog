'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { MacBrowserShell } from '@/components/mac-browser-shell'

interface DemoItem {
  type: string
  duration: number
  content: React.ReactNode
}

const demoList: DemoItem[] = [
  {
    type: 'translation',
    duration: 3000,
    content: <TranslationDemo />,
  },
  {
    type: 'read',
    duration: 5000,
    content: <ReadDemo />,
  },
]

const variants = {
  initial: (direction: number) => {
    return { x: `${80 * direction}%`, opacity: 0 }
  },
  active: { x: '0%', opacity: 1 },
  exit: (direction: number) => {
    return { x: `${-80 * direction}%`, opacity: 0 }
  },
}

export function Demo() {
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  // useEffect(() => {
  //   if (!isAutoPlaying)
  //     return

  //   const currentDemo = demoList[currentStep]

  //   if (!currentDemo)
  //     return

  //   const { duration } = currentDemo

  //   const timeout = setTimeout(() => {
  //     const nextStep = (currentStep + 1) % demoList.length
  //     setCurrentStep(nextStep)
  //     setDirection(nextStep > currentStep ? 1 : -1)
  //   }, duration)

  //   return () => clearTimeout(timeout)
  // }, [isAutoPlaying, currentStep])

  const handleMouseEnter = () => setIsAutoPlaying(false)
  const handleMouseLeave = () => setIsAutoPlaying(true)

  const switchDemo = (nextStep: number) => {
    setCurrentStep(nextStep)
    setDirection(nextStep > currentStep ? 1 : -1)
    setIsAutoPlaying(false)
  }

  return (
    <section
      className="flex justify-center h-[90vh] bg-zinc-50 dark:bg-zinc-900 overflow-hidden"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="w-full flex flex-col gap-8 items-center overflow-hidden">
        <MacBrowserShell url="https://readfrog.app" className="mx-auto flex-auto w-6xl h-full overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div
              variants={variants}
              key={currentStep}
              initial="initial"
              animate="active"
              exit="exit"
              custom={direction}
              transition={{
                duration: 0.5,
              }}
            >
              {demoList[currentStep]?.content}
            </motion.div>
          </AnimatePresence>
        </MacBrowserShell>

        <ul className="flex w-full items-center justify-center border-y border-zinc-200 dark:border-zinc-800 divide-x divide-zinc-200 dark:divide-zinc-800">
          {demoList.map((demo, demoIndex) => (
            <DemoSwitchButton key={demo.type} demo={demo} onClick={() => switchDemo(demoIndex)} focus={currentStep === demoIndex} />
          ))}
        </ul>
      </div>
    </section>
  )
}

function TranslationDemo() {
  return (
    <div className="p-8 text-center">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
        A
      </h2>
    </div>
  )
}

function ReadDemo() {
  return (
    <div className="p-8 text-center">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
        B
      </h2>
    </div>
  )
}

function DemoSwitchButton({ demo, onClick, focus }: { demo: DemoItem, onClick: () => void, focus: boolean }) {
  return (
    <motion.li
      key={demo.type}
      onClick={onClick}
      animate={{
        backgroundColor: focus ? '#eee' : '#eee0',
      }}
      className="flex justify-center items-center h-full"
    >
      <div className="h-30 w-60 p-4">
        <motion.div layoutId="underline" />
        {demo.type}
      </div>
    </motion.li>
  )
}
