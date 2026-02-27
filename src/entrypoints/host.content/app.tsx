import FrogToast from "@/components/frog-toast"
import { NOTRANSLATE_CLASS } from "@/utils/constants/dom-labels"

export default function App() {
  return (
    <div className={NOTRANSLATE_CLASS}>
      <FrogToast />
    </div>
  )
}
