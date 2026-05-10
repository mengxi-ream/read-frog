// @vitest-environment jsdom
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { createOutputSchemaField } from "@/utils/constants/custom-action"
import { formOpts, useAppForm } from "../form"
import { IconField } from "../icon-field"

const translations: Record<string, string> = {
  "options.floatingButtonAndToolbar.selectionToolbar.customActions.form.icon": "图标",
  "options.floatingButtonAndToolbar.selectionToolbar.customActions.errors.invalidIcon": "无效图标",
}

vi.mock("#imports", () => ({
  i18n: {
    t: (key: string) => translations[key] ?? key,
  },
}))

vi.mock("@iconify/react", () => ({
  Icon: ({ icon, className }: { icon: string, className?: string }) => (
    <span data-testid={`icon-${icon}`} data-icon={icon} className={className} />
  ),
}))

function createDefaultAction(): SelectionToolbarCustomAction {
  return {
    id: "action-1",
    name: "Summarize",
    enabled: true,
    icon: "tabler:book-2",
    providerId: "provider-1",
    systemPrompt: "You are helpful.",
    prompt: "Summarize this.",
    outputSchema: [
      createOutputSchemaField("Result"),
    ],
  }
}

function IconFieldHarness() {
  const [submittedIcon, setSubmittedIcon] = useState("")
  const form = useAppForm({
    ...formOpts,
    defaultValues: createDefaultAction(),
    onSubmit: async ({ value }) => {
      setSubmittedIcon(value.icon)
    },
  })

  return (
    <form.AppForm>
      <IconField form={form} />
      <div data-testid="submitted-icon">{submittedIcon}</div>
    </form.AppForm>
  )
}

describe("iconField", () => {
  it("opens the left icon picker popover", () => {
    render(<IconFieldHarness />)

    fireEvent.click(screen.getByRole("button", { name: "Choose icon" }))

    expect(screen.getByText("Choose an icon")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "tabler:book-2" })).toBeInTheDocument()
  })

  it("updates the icon value when a curated icon is selected", async () => {
    render(<IconFieldHarness />)

    fireEvent.click(screen.getByRole("button", { name: "Choose icon" }))
    fireEvent.click(screen.getByRole("button", { name: "tabler:wand" }))

    await waitFor(() => {
      expect(screen.getByDisplayValue("tabler:wand")).toBeInTheDocument()
      expect(screen.getByTestId("submitted-icon")).toHaveTextContent("tabler:wand")
    })
  })

  it("opens the right help popover", () => {
    render(<IconFieldHarness />)

    fireEvent.click(screen.getByRole("button", { name: "More icon help" }))

    expect(screen.getByText("Can't find the icon you want?")).toBeInTheDocument()
    expect(screen.getByText("Iconify")).toBeInTheDocument()
    expect(screen.getByText("tabler:book-2")).toBeInTheDocument()
  })

  it("falls back to English when icon field translations are missing", () => {
    render(<IconFieldHarness />)

    expect(screen.getByPlaceholderText("Enter an icon name")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Choose icon" }))
    expect(screen.getByText("Choose an icon")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "More icon help" }))
    expect(screen.getByText("Can't find the icon you want?")).toBeInTheDocument()
  })
})
