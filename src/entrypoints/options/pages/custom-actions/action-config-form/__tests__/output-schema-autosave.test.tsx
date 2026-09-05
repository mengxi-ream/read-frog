// @vitest-environment jsdom
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { StrictMode } from "react"
import { createMemoryRouter, Link, RouterProvider } from "react-router"
import { afterEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { AutosaveNavigation } from "@/components/form/autosave-navigation"
import { ToastProvider } from "@/components/ui/base-ui/toast"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
import { configSchema } from "@/types/config/config"
import { selectionToolbarCustomActionSchema } from "@/types/config/selection-toolbar"
import { configAtom } from "@/utils/atoms/config"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import { CustomActionConfigForm } from ".."
import { selectedCustomActionIdAtom } from "../../atoms"

// Keep remote discovery/auth out of this test. The schema editor, parent form,
// validation, autosave controller, entity writer and navigation are all real.
vi.mock("../provider-field", () => ({ ProviderField: () => null }))
vi.mock("../notebase-connection-field", () => ({ NotebaseConnectionField: () => null }))

function createAction(): SelectionToolbarCustomAction {
  return {
    id: "mapped-action",
    name: "Vocabulary",
    icon: "tabler:book",
    providerId: "read-frog-free-ai",
    systemPrompt: "Explain the selected text.",
    prompt: "{{selection}}",
    outputSchema: ["meaning", "example"].map((id) => ({
      id,
      name: id,
      type: "string",
      description: id,
      speaking: false,
    })),
    notebaseConnection: {
      notebaseId: "words",
      notebaseNameSnapshot: "Words",
      connectedAccount: { id: "reader", name: "Reader", email: "reader@example.com" },
      mappings: ["meaning", "example"].map((id) => ({
        id: `${id}-mapping`,
        localFieldId: id,
        notebaseColumnId: `${id}-column`,
        notebaseColumnNameSnapshot: id,
      })),
    },
  }
}

async function setup(action: SelectionToolbarCustomAction) {
  const config = structuredClone(DEFAULT_CONFIG)
  config.selectionToolbar.customActions = [action]
  await fakeBrowser.storage.local.set({ [CONFIG_STORAGE_KEY]: config })
  const store = createStore()
  store.set(configAtom, config)
  await store.set(selectedCustomActionIdAtom, action.id)
  const router = createMemoryRouter([
    {
      path: "/",
      element: (
        <>
          <AutosaveNavigation />
          <CustomActionConfigForm />
          <Link to="/done">Leave editor</Link>
        </>
      ),
    },
    { path: "/done", element: <p>Left editor</p> },
  ])
  render(
    <StrictMode>
      <Provider store={store}>
        <ToastProvider>
          <TooltipProvider>
            <RouterProvider router={router} />
          </TooltipProvider>
        </ToastProvider>
      </Provider>
    </StrictMode>,
  )
  return { router, store }
}

async function deleteMeaning() {
  const row = screen.getByText("meaning", { selector: "span.font-medium" }).parentElement!
  const deleteButton = within(row).getAllByRole("button")[1]!
  fireEvent.click(deleteButton)
  const dialog = await screen.findByRole("alertdialog")
  fireEvent.click(
    within(dialog).getByRole("button", {
      name: "options.selectionToolbar.customActions.form.deleteFieldDialog.confirm",
    }),
  )
}

async function getPersistedAction(): Promise<SelectionToolbarCustomAction> {
  const stored = await fakeBrowser.storage.local.get(CONFIG_STORAGE_KEY)
  return configSchema.parse(stored[CONFIG_STORAGE_KEY]).selectionToolbar.customActions[0]!
}

describe("output schema autosave", () => {
  afterEach(() => vi.restoreAllMocks())
  it("persists mapped-field deletion and removes its mapping before form validation", async () => {
    const action = createAction()
    const { router, store } = await setup(action)
    const writes = vi.spyOn(fakeBrowser.storage.local, "set")
    const expected: SelectionToolbarCustomAction = {
      ...action,
      outputSchema: [action.outputSchema[1]!],
      notebaseConnection: {
        ...action.notebaseConnection!,
        mappings: [action.notebaseConnection!.mappings[1]!],
      },
    }

    await deleteMeaning()

    await waitFor(async () => expect(await getPersistedAction()).toEqual(expected))
    expect(selectionToolbarCustomActionSchema.safeParse(await getPersistedAction()).success).toBe(
      true,
    )
    expect(store.get(configAtom).selectionToolbar.customActions[0]).toEqual(expected)
    const configWrites = writes.mock.calls.filter(([items]) =>
      Object.hasOwn(items, CONFIG_STORAGE_KEY),
    )
    expect(configWrites).toHaveLength(1)
    expect(configWrites[0]![0]).toMatchObject({
      [CONFIG_STORAGE_KEY]: { selectionToolbar: { customActions: [expected] } },
    })

    fireEvent.click(screen.getByRole("link", { name: "Leave editor" }))
    await waitFor(() => expect(router.state.location.pathname).toBe("/done"))
    expect(screen.queryByText("options.autosave.leaveTitle")).not.toBeInTheDocument()
  })

  it("preserves the connection and remaining mapping when deleting an unmapped field", async () => {
    const action = createAction()
    action.notebaseConnection!.mappings = [action.notebaseConnection!.mappings[1]!]
    await setup(action)

    await deleteMeaning()

    await waitFor(async () =>
      expect((await getPersistedAction()).outputSchema).toEqual([action.outputSchema[1]!]),
    )
    expect((await getPersistedAction()).notebaseConnection).toEqual(action.notebaseConnection)
  })

  it("deletes a field normally when no Notebase is connected", async () => {
    const action = createAction()
    delete action.notebaseConnection
    await setup(action)

    await deleteMeaning()

    await waitFor(async () =>
      expect((await getPersistedAction()).outputSchema).toEqual([action.outputSchema[1]!]),
    )
    expect((await getPersistedAction()).notebaseConnection).toBeUndefined()
  })
})
