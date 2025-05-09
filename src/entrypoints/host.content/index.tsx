import "@/assets/tailwind/theme.css";
import "@/assets/tailwind/text-small.css";

export default defineContentScript({
  matches: ["*://*/*"],
  async main(ctx) {
    const ui = createIntegratedUi(ctx, {
      position: "inline",
      anchor: "body",
      onMount: (container) => {
        // Append children to the container
        // const app = document.createElement("p");
        // app.textContent = "Hello host.content!";
        // container.append(app);
      },
    });

    // Call mount to add the UI to the DOM
    ui.mount();
  },
});

// function registerTranslationTriggers() {

// }
