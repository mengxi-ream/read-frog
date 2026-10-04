import {
  deleteCustomActionResult,
  listCustomActionResults,
  saveCustomActionResults,
  testWebDavCustomActionResultStorage,
} from "@/utils/custom-action-result-storage/service"
import { onMessage } from "@/utils/message"

export function setupCustomActionResultStorageMessageHandlers(): void {
  onMessage("saveCustomActionResults", (message) => saveCustomActionResults(message.data))
  onMessage("listCustomActionResults", () => listCustomActionResults())
  onMessage("deleteCustomActionResult", (message) => deleteCustomActionResult(message.data.id))
  onMessage("testWebDavCustomActionResultStorage", () => testWebDavCustomActionResultStorage())
}
