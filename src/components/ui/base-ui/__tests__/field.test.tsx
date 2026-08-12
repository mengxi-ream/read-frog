// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Checkbox } from "@/components/ui/base-ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/base-ui/field"

describe("Field", () => {
  it("renders the shadcn choice-card composition", () => {
    render(
      <FieldLabel>
        <Field orientation="horizontal">
          <Checkbox defaultChecked />
          <FieldContent>
            <FieldTitle>Enable notifications</FieldTitle>
            <FieldDescription>Receive product updates.</FieldDescription>
          </FieldContent>
        </Field>
      </FieldLabel>,
    )

    const checkbox = screen.getByRole("checkbox", { name: /enable notifications/i })
    const field = checkbox.closest('[data-slot="field"]')
    const label = field?.parentElement

    expect(checkbox).toBeChecked()
    expect(field).toHaveAttribute("role", "group")
    expect(field).toHaveAttribute("data-orientation", "horizontal")
    expect(label).toHaveAttribute("data-slot", "field-label")
    expect(label?.tagName).toBe("LABEL")
    expect(label).toHaveClass("has-data-checked:bg-primary/5")
  })
})
