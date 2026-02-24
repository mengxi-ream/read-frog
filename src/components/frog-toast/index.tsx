import { kebabCase } from "case-anything"
import * as React from "react"

import { Toaster } from "sonner"
import frogIcon from "@/assets/icons/read-frog.png"
import { APP_NAME } from "@/utils/constants/app"

const frogIconElement = (
  <img
    src={frogIcon}
    alt="🐸"
    style={{
      maxWidth: "100%",
      height: "auto",
      minHeight: "20px",
      minWidth: "20px",
    }}
  />
)

function FrogToast(props: React.ComponentProps<typeof Toaster>) {
  return (
    <Toaster
      {...props}
      richColors
      icons={{
        warning: frogIconElement,
        success: frogIconElement,
        error: frogIconElement,
        info: frogIconElement,
        loading: frogIconElement,
      }}
      toastOptions={{
        className: `${kebabCase(APP_NAME)}-toaster`,
      }}
      className="z-[2147483647] notranslate"
    />
  )
}

export default FrogToast
