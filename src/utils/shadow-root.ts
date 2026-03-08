export function insertShadowRootUIWrapperInto(container: HTMLElement) {
  const wrapper = document.createElement("div")
  wrapper.className = "text-base antialiased font-sans z-[2147483647]"
  container.append(wrapper)

  return wrapper
}
