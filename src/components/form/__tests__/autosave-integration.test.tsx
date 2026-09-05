// @vitest-environment jsdom
import type { AutosaveController } from "../autosave-controller"
import { createFormHook } from "@tanstack/react-form"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { StrictMode, useState } from "react"
import { createMemoryRouter, Link, RouterProvider } from "react-router"
import { describe, expect, it, vi } from "vitest"
import { ToastProvider } from "@/components/ui/base-ui/toast"
import {
  AutosaveBoundary,
  AutosaveNavigation,
  requestEditorNavigationAtom,
} from "../autosave-navigation"
import { fieldContext, formContext } from "../form-context"
import { InputFieldAutoSave } from "../input-field-auto-save"
import { QuickInsertableTextareaFieldAutoSave } from "../quick-insertable-textarea-field-auto-save"
import { toAutosaveSession, useAutosave } from "../use-autosave"

type Draft = { id: string; name: string; prompt: string; amount: number | undefined }
const initial: Draft = { id: "one", name: "Initial", prompt: "", amount: 1 }
const { useAppForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { InputFieldAutoSave },
  formComponents: {},
})

function Editor({
  save,
  onSave,
}: {
  save?: (value: Draft) => Promise<void>
  onSave?: (value: Draft) => void
}) {
  const [saved, setSaved] = useState(initial)
  const form = useAppForm({
    defaultValues: initial,
    validators: { onChange: ({ value }) => (value.name ? undefined : "Name required") },
    onSubmitMeta: { revision: 0 },
    onSubmit: async ({ value, meta }) => autosave.commit(value, meta.revision),
  })
  const autosave: AutosaveController<Draft> = useAutosave({
    initialValue: initial,
    getDraft: () => form.state.values,
    setField: (key, value) => form.setFieldValue(key, value as never),
    reset: (value) => form.reset(value),
    submit: (revision) => form.handleSubmit({ revision }),
    persist: async (value) => {
      await save?.(value)
      setSaved(value)
      onSave?.(value)
    },
  })
  return (
    <AutosaveBoundary session={toAutosaveSession(autosave)}>
      <form.AppField name="name">
        {(field) => <field.InputFieldAutoSave label="Name" />}
      </form.AppField>
      <form.AppField name="prompt">
        {() => (
          <QuickInsertableTextareaFieldAutoSave
            label="Prompt"
            insertCells={[{ text: "{{selection}}", description: "Insert selection" }]}
          />
        )}
      </form.AppField>
      <form.AppField name="amount">
        {(field) => <field.InputFieldAutoSave label="Amount" type="number" />}
      </form.AppField>
      <output aria-label="saved-name">{saved.name}</output>
      <output aria-label="saved-prompt">{saved.prompt}</output>
      <output aria-label="saved-amount">{String(saved.amount)}</output>
      <Link to="/other">Leave editor</Link>
    </AutosaveBoundary>
  )
}

function setup(save?: (value: Draft) => Promise<void>) {
  const onSave = vi.fn<(value: Draft) => void>()
  const store = createStore()
  const router = createMemoryRouter([
    {
      element: (
        <>
          <AutosaveNavigation />
          <Editor save={save} onSave={onSave} />
        </>
      ),
      path: "/",
    },
    {
      path: "/other",
      element: (
        <>
          <AutosaveNavigation />
          <p>Other page</p>
        </>
      ),
    },
  ])
  render(
    <StrictMode>
      <Provider store={store}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </Provider>
    </StrictMode>,
  )
  return { router, store, onSave }
}

describe("real form autosave integration", () => {
  it("keeps Chinese composition in the input and saves only the committed value on blur", async () => {
    const { onSave } = setup()
    const input = screen.getByRole("textbox", { name: "Name" })
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: "nihao" } })
    expect(input).toHaveValue("nihao")
    fireEvent.blur(input)
    await act(async () => {
      await Promise.resolve()
    })
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.compositionEnd(input, { target: { value: "你好" } })
    await waitFor(() => expect(screen.getByLabelText("saved-name")).toHaveTextContent("你好"))
    expect(input).toHaveValue("你好")
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it("protects prompt composition and saves token insertion through the same controller", async () => {
    const { onSave } = setup()
    const input = screen.getByRole("textbox", { name: "Prompt" })
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: "fanyi" } })
    fireEvent.blur(input)
    await act(async () => {
      await Promise.resolve()
    })
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.compositionEnd(input, { target: { value: "翻译" } })
    await waitFor(() => expect(screen.getByLabelText("saved-prompt")).toHaveTextContent("翻译"))
    fireEvent.click(screen.getByRole("button", { name: "{{selection}}" }))
    fireEvent.blur(input)
    await waitFor(() =>
      expect(screen.getByLabelText("saved-prompt")).toHaveTextContent("{{selection}}"),
    )
  })

  it("waits for saving before allowing a route change", async () => {
    let finish!: () => void
    const save = vi.fn<(value: Draft) => Promise<void>>(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const { router } = setup(save)
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Updated" },
    })
    fireEvent.click(screen.getByRole("link", { name: "Leave editor" }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(router.state.location.pathname).toBe("/")
    await act(async () => {
      finish()
    })
    await waitFor(() => expect(router.state.location.pathname).toBe("/other"))
  })

  it("blocks invalid navigation, keeps the draft, and supports explicit discard", async () => {
    const { router, onSave } = setup()
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "" } })
    fireEvent.click(screen.getByRole("link", { name: "Leave editor" }))
    await screen.findByRole("alertdialog")
    expect(router.state.location.pathname).toBe("/")
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.queryByText("options.autosave.invalid")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "options.autosave.keepEditing" }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("")
    fireEvent.click(screen.getByRole("link", { name: "Leave editor" }))
    await screen.findByRole("alertdialog")
    fireEvent.click(screen.getByRole("button", { name: "options.autosave.discard" }))
    await waitFor(() => expect(router.state.location.pathname).toBe("/other"))
  })

  it("reports failed saves in a toast and retries without losing the draft", async () => {
    const save = vi
      .fn<(value: Draft) => Promise<void>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined)
    const { store } = setup(save)
    const create = vi.fn<() => void>()
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Keep" } })
    let navigation!: Promise<boolean>
    await act(async () => {
      navigation = store.set(requestEditorNavigationAtom, create)
    })
    await screen.findByRole("alertdialog")
    expect(create).not.toHaveBeenCalled()
    expect(
      screen.getByText("options.autosave.failed").closest('[data-slot="toast-content"]'),
    ).not.toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "options.autosave.keepEditing" }))
    expect(await navigation).toBe(false)
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Keep")
    fireEvent.click(screen.getByRole("button", { name: "options.autosave.retry" }))
    await waitFor(() => expect(screen.getByLabelText("saved-name")).toHaveTextContent("Keep"))
  })

  it("keeps numeric clearing semantics and flushes without waiting 500ms", async () => {
    setup()
    const input = screen.getByRole("spinbutton", { name: "Amount" })
    fireEvent.change(input, { target: { value: "" } })
    fireEvent.blur(input)
    await waitFor(() =>
      expect(screen.getByLabelText("saved-amount")).toHaveTextContent("undefined"),
    )
  })
})
