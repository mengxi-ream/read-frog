import "@/assets/tailwind/theme.css";
import "@/assets/tailwind/text-small.css";
import "./style.css";
import { handleShowOrHideTranslationAction } from "@/utils/host/translate";
import { isEditable } from "@/utils/host/dom";

export default defineContentScript({
  matches: ["*://*/*"],
  async main() {
    await loadGlobalConfigPromise;
    registerTranslationTriggers();
    // const ui = createIntegratedUi(ctx, {
    //   position: "inline",
    //   anchor: "body",
    //   onMount: (container) => {
    //     // Append children to the container
    //     const app = document.createElement("p");
    //     app.textContent = "Hello host.content!";
    //     app.classList.add("rf-translation-spinner");
    //     container.append(app);
    //   },
    // });

    // // Call mount to add the UI to the DOM
    // ui.mount();
  },
});

function registerTranslationTriggers() {
  const spinner = document.createElement("span");
  spinner.className = "rf-spinner";
  document.body.append(spinner);

  const mousePosition = { x: 0, y: 0 };
  const keyState = {
    isHotkeyPressed: false,
    isOtherKeyPressed: false,
  };

  const getHotkey = () => globalConfig?.manualTranslate.hotkey;
  const isEnabled = () => globalConfig?.manualTranslate.enabled;

  let timerId: NodeJS.Timeout | null = null; // 延时触发的定时器
  let actionTriggered = false;

  // Listen the hotkey means the user can't press or hold any other key during the hotkey is holding
  document.addEventListener("keydown", (e) => {
    if (!isEnabled()) return;
    if (e.target instanceof HTMLElement && isEditable(e.target)) return;

    if (e.key === getHotkey()) {
      if (!keyState.isHotkeyPressed) {
        keyState.isHotkeyPressed = true;
        // If user hold other key, it will trigger keyState.isOtherKeyPressed = true; later by repeat event
        keyState.isOtherKeyPressed = false;
        timerId = setTimeout(() => {
          if (!keyState.isOtherKeyPressed && keyState.isHotkeyPressed) {
            handleShowOrHideTranslationAction(mousePosition.x, mousePosition.y);
            actionTriggered = true;
          }
          timerId = null;
        }, 500); // 延迟 500ms，可根据需要调整
      }
    } else if (keyState.isHotkeyPressed) {
      // don't translate if user press other key
      keyState.isOtherKeyPressed = true;
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
    }
  });

  document.addEventListener("keyup", (e) => {
    if (!isEnabled()) return;
    if (e.target instanceof HTMLElement && isEditable(e.target)) return;
    if (e.key === getHotkey()) {
      // translate if user release the hotkey and no other key is pressed
      if (!keyState.isOtherKeyPressed) {
        if (timerId) {
          clearTimeout(timerId);
          timerId = null;
        }
        if (!actionTriggered) {
          handleShowOrHideTranslationAction(mousePosition.x, mousePosition.y);
        }
      }
      actionTriggered = false;
      keyState.isHotkeyPressed = false;
      keyState.isOtherKeyPressed = false;
    }
  });

  document.body.addEventListener("mousemove", (event) => {
    mousePosition.x = event.clientX;
    mousePosition.y = event.clientY;
  });
}
