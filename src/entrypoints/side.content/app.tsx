import { logger } from "@/utils/logger";

import FloatingButton from "./components/floating-button";
import SideContent from "./components/side-content";

export default function App() {
  logger.log("side.content");
  logger.info("side.content");
  logger.warn("side.content");
  logger.error("side.content");
  return (
    <div className="text-black dark:text-white">
      <FloatingButton />
      <SideContent />
    </div>
  );
}
