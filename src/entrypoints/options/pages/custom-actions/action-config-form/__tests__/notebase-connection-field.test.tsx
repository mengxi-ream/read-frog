// @vitest-environment jsdom
import type { NotebaseGetSchemaOutput } from "@read-frog/api-contract"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { createMemoryRouter, RouterProvider } from "react-router"
import { describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { ToastProvider } from "@/components/ui/base-ui/toast"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
import { configSchema } from "@/types/config/config"
import { configAtom } from "@/utils/atoms/config"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import { CustomActionConfigForm } from ".."
import { customActionEditorTabAtom, selectedCustomActionIdAtom } from "../../atoms"

// The connection field, the form and its autosave are real; the session and the
// Notebase API are stubbed, and fields unrelated to the connection render nothing.
vi.mock("../provider-field", () => ({ ProviderField: () => null }))
vi.mock("../layout-field", () => ({ LayoutField: () => null, ReadOnlyLayoutField: () => null }))

const reader = { id: "reader", name: "Reader", email: "reader@example.com", image: null }

vi.mock("@/utils/auth/auth-client", () => ({
  authClient: { useSession: () => ({ data: { user: reader }, isPending: false }) },
}))

function createColumn(notebaseId: string, id: string, name: string) {
  return {
    id,
    notebaseId,
    name,
    config: { type: "string" as const },
    position: 0,
    isPrimary: false,
    wrap: false,
    width: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

const schemas: Record<string, NotebaseGetSchemaOutput> = {
  // Created from the action: its columns carry the fields' names.
  words: {
    id: "words",
    name: "Words",
    updatedAt: new Date(),
    notebaseColumns: ["term", "phonetic", "meaning"].map((name) =>
      createColumn("words", `words-${name}`, name),
    ),
  },
  // Made by hand: two columns share a field's name, one does not.
  reading: {
    id: "reading",
    name: "Reading",
    updatedAt: new Date(),
    notebaseColumns: [
      createColumn("reading", "reading-term", "Term"),
      createColumn("reading", "reading-meaning", " meaning "),
      createColumn("reading", "reading-ipa", "IPA"),
    ],
  },
}

vi.mock("@/utils/orpc/client", () => ({
  orpc: {
    notebase: {
      list: {
        queryOptions: ({ input: _input, ...options }: Record<string, unknown>) => ({
          ...options,
          queryKey: ["notebase", "list"],
          queryFn: async () => Object.values(schemas).map(({ id, name }) => ({ id, name })),
        }),
      },
      getSchema: {
        queryOptions: ({ input, ...options }: { input: { id: string } }) => ({
          ...options,
          queryKey: ["notebase", "schema", input.id],
          queryFn: async () => schemas[input.id],
        }),
      },
    },
  },
}))

function createAction(): SelectionToolbarCustomAction {
  return {
    id: "vocabulary",
    name: "Vocabulary",
    icon: "tabler:book",
    providerId: "read-frog-free-ai",
    systemPrompt: "Explain the selected word.",
    prompt: "{{selection}}",
    outputSchema: ["term", "phonetic", "meaning"].map((name) => ({
      id: `field-${name}`,
      name,
      type: "string",
      description: name,
    })),
    notebaseConnection: {
      notebaseId: "words",
      notebaseNameSnapshot: "Words",
      connectedAccount: reader,
      mappings: ["term", "phonetic", "meaning"].map((name) => ({
        id: `mapping-${name}`,
        localFieldId: `field-${name}`,
        notebaseColumnId: `words-${name}`,
        notebaseColumnNameSnapshot: name,
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
  store.set(customActionEditorTabAtom, "notebase")
  const router = createMemoryRouter([{ path: "/", element: <CustomActionConfigForm /> }])
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Provider store={store}>
        <ToastProvider>
          <TooltipProvider>
            <RouterProvider router={router} />
          </TooltipProvider>
        </ToastProvider>
      </Provider>
    </QueryClientProvider>,
  )
  // The mappings render once the connected Notebase's columns have loaded.
  await screen.findAllByText("phonetic")
}

const SKIP_LABEL = "options.selectionToolbar.customActions.form.notebase.skipFieldOption"
const UNDECIDED_LABEL =
  "options.selectionToolbar.customActions.form.notebase.undecidedFieldPlaceholder"

async function pick(trigger: HTMLElement, optionText: string) {
  await act(async () => {
    for (const type of ["pointerdown", "mousedown", "click"]) {
      trigger.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }))
    }
  })
  const option = (await screen.findAllByRole("option")).find(
    (element) => element.textContent === optionText,
  )!
  await act(async () => {
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      option.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }))
    }
  })
}

async function pickNotebase(currentName: string, name: string) {
  const trigger = (await screen.findAllByRole("combobox")).find((element) =>
    element.textContent?.startsWith(currentName),
  )!
  await pick(trigger, name)
}

/** The column select on a field's row: the row is the field's name and its select. */
function fieldTrigger(fieldName: string) {
  const label = screen
    .getAllByText(fieldName, { exact: true })
    .find((element) => element.parentElement?.querySelector('[role="combobox"]'))!
  return label.parentElement!.querySelector<HTMLElement>('[role="combobox"]')!
}

async function getPersistedConnection() {
  const stored = await fakeBrowser.storage.local.get(CONFIG_STORAGE_KEY)
  const action = configSchema.parse(stored[CONFIG_STORAGE_KEY]).selectionToolbar.customActions[0]!
  return action.notebaseConnection
}

async function getPersistedMappings() {
  return (await getPersistedConnection())?.mappings.map(({ localFieldId, notebaseColumnId }) => ({
    localFieldId,
    notebaseColumnId,
  }))
}

describe("notebase connection field", () => {
  it("keeps every mapping when the connected Notebase is picked again", async () => {
    const action = createAction()
    // Mapped by hand, phonetic → IPA included, which no name match would restore.
    action.notebaseConnection = {
      notebaseId: "reading",
      notebaseNameSnapshot: "Reading",
      connectedAccount: reader,
      mappings: [
        ["term", "reading-term"],
        ["phonetic", "reading-ipa"],
        ["meaning", "reading-meaning"],
      ].map(([name, notebaseColumnId]) => ({
        id: `mapping-${name}`,
        localFieldId: `field-${name}`,
        notebaseColumnId: notebaseColumnId!,
        notebaseColumnNameSnapshot: name!,
      })),
    }
    await setup(action)

    await pickNotebase("Reading", "Reading")

    // Give an autosave that should not happen the time to land.
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)))
    expect(await getPersistedMappings()).toEqual(
      action.notebaseConnection.mappings.map(({ localFieldId, notebaseColumnId }) => ({
        localFieldId,
        notebaseColumnId,
      })),
    )
  })

  it("maps the fields that share a column's name when another Notebase is picked", async () => {
    await setup(createAction())

    await pickNotebase("Words", "Reading")

    await waitFor(async () =>
      expect(await getPersistedMappings()).toEqual([
        { localFieldId: "field-term", notebaseColumnId: "reading-term" },
        { localFieldId: "field-meaning", notebaseColumnId: "reading-meaning" },
      ]),
    )
    // The field no column is named after is left undecided, not guessed.
    await waitFor(() => expect(fieldTrigger("phonetic").textContent).toContain(UNDECIDED_LABEL))
    expect((await getPersistedConnection())?.skippedFieldIds).toBeUndefined()
  })

  it("saves a field to a column, or not at all, from its row", async () => {
    const action = createAction()
    action.notebaseConnection = {
      notebaseId: "reading",
      notebaseNameSnapshot: "Reading",
      connectedAccount: reader,
      mappings: [
        ["term", "reading-term", "Term"],
        ["meaning", "reading-meaning", " meaning "],
      ].map(([name, notebaseColumnId, columnName]) => ({
        id: `mapping-${name}`,
        localFieldId: `field-${name}`,
        notebaseColumnId: notebaseColumnId!,
        notebaseColumnNameSnapshot: columnName!,
      })),
    }
    await setup(action)
    // The rows render once the Notebase's columns have loaded.
    await waitFor(() => expect(fieldTrigger("phonetic").textContent).toContain(UNDECIDED_LABEL))

    await pick(fieldTrigger("phonetic"), "IPA")
    await waitFor(async () =>
      expect(await getPersistedMappings()).toContainEqual({
        localFieldId: "field-phonetic",
        notebaseColumnId: "reading-ipa",
      }),
    )

    await pick(fieldTrigger("phonetic"), SKIP_LABEL)
    await waitFor(async () => {
      const connection = await getPersistedConnection()
      expect(connection?.skippedFieldIds).toEqual(["field-phonetic"])
      expect(connection?.mappings.map((mapping) => mapping.localFieldId)).toEqual([
        "field-term",
        "field-meaning",
      ])
    })
    expect(fieldTrigger("phonetic").textContent).toContain(SKIP_LABEL)
  })
})
