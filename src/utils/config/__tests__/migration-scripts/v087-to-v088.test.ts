import { describe, expect, it } from "vitest"
import {
  getPendingDictionaryRekeyedActionId,
  migrate,
  migrateWithPendingDictionarySave,
} from "../../migration-scripts/v087-to-v088"

const currentDictionary = {
  id: "default-dictionary",
  name: "Dictionary",
  enabled: true,
  icon: "tabler:book-2",
  providerId: "provider-1",
  systemPrompt:
    'You are a dictionary assistant for language learners.\n\n## Goal\nGiven a term and its surrounding paragraphs, produce a concise dictionary entry that matches the required output object.\n\n## Rules\n1. Focus on the meaning that best matches the provided paragraphs.\n2. Normalize Term to its base/canonical form.\n3. Keep Definition precise and learner-friendly.\n4. Keep Paragraphs exactly as provided in the prompt.\n5. Phonetic must use the standard notation for the term\'s language (e.g., IPA for English, pinyin for Mandarin, romaji for Japanese).\n6. Part of Speech in English (noun, verb, adjective, etc.).\n7. Difficulty must be a CEFR level (A1, A2, B1, B2, C1, or C2).\n8. If a field is unknown, return an empty string instead of guessing.\n9. Respond in {{targetLanguage}} for all textual fields unless source-form text is required for clarity.\n\n## Examples\n\n### Example 1\nInput: Selection="blossoms", Paragraphs="The ephemeral beauty of cherry blossoms reminds us to cherish each moment.", Target language=Chinese\n\nOutput:\n- Term: blossom\n- Phonetic: /ˈblɒs.əm/\n- Part of Speech: noun\n- Paragraphs: The ephemeral beauty of cherry blossoms reminds us to cherish each moment.\n- Definition: 花；花朵（尤指果树的花）\n- Paragraphs Translation: 樱花短暂的美丽提醒我们珍惜每一刻。\n- Difficulty: B2\n\n### Example 2\nInput: Selection="感動", Paragraphs="この映画はつまらないと思ったけど、最後は感動した。", Target language=English\n\nOutput:\n- Term: 感動\n- Phonetic: kandou\n- Part of Speech: noun\n- Paragraphs: この映画はつまらないと思ったけど、最後は感動した。\n- Definition: Being deeply moved; emotional touch\n- Paragraphs Translation: I thought this movie was boring, but the ending was moving.\n- Difficulty: B1',
  prompt:
    "## Input\nSelection: {{selection}}\nParagraphs: {{paragraphs}}\nTarget language: {{targetLanguage}}",
  outputSchema: [
    {
      id: "default-dictionary-term",
      name: "Term",
      type: "string",
      description: "Base/canonical lemma of the selected term.",
      speaking: true,
    },
    {
      id: "default-dictionary-phonetic",
      name: "Phonetic",
      type: "string",
      description:
        "Standard phonetic transcription for the term's language (e.g., IPA for English, pinyin for Mandarin, romaji for Japanese).",
      speaking: false,
    },
    {
      id: "default-dictionary-part-of-speech",
      name: "Part of Speech",
      type: "string",
      description: "Grammatical category (e.g., noun, verb, adjective).",
      speaking: false,
    },
    {
      id: "default-dictionary-definition",
      name: "Definition",
      type: "string",
      description: "One concise definition for the contextual sense.",
      speaking: false,
    },
    {
      id: "default-dictionary-context",
      name: "Paragraphs",
      type: "string",
      description: "The paragraphs from the prompt above. Do not rewrite them.",
      speaking: true,
    },
    {
      id: "default-dictionary-context-translation",
      name: "Paragraphs Translation",
      type: "string",
      description: "The translation of the paragraphs.",
      speaking: false,
    },
    {
      id: "default-dictionary-difficulty",
      name: "Difficulty",
      type: "string",
      description: "Estimated CEFR difficulty level A1, A2, B1, B2, C1, or C2.",
      speaking: false,
    },
  ],
}

const connection = {
  notebaseId: "notebase-1",
  notebaseNameSnapshot: "Words",
  connectedAccount: {
    id: "account-1",
    name: "Reader",
    email: "reader@example.com",
    image: null,
  },
  mappings: [
    {
      id: "mapping-1",
      localFieldId: "default-dictionary-term",
      notebaseColumnId: "column-1",
      notebaseColumnNameSnapshot: "Term",
    },
  ],
}

function config(action: any, extraActions: any[] = []): any {
  return {
    providersConfig: [
      {
        id: "provider-1",
        name: "OpenAI",
        enabled: true,
        provider: "openai",
        model: { model: "gpt-4o-mini", isCustomModel: false, customModel: null },
      },
    ],
    selectionToolbar: {
      saveSuggestion: {
        enabled: true,
      },
      customActions: [...(action ? [action] : []), ...extraActions],
    },
  }
}

describe("v087-to-v088 migration", () => {
  it("moves an untouched Dictionary into built-in state with mutable state preserved", () => {
    const migrated = migrate(
      config({ ...currentDictionary, enabled: false, notebaseConnection: connection }),
    )

    expect(migrated.selectionToolbar.builtInActions.dictionary).toEqual({
      enabled: false,
      providerId: "provider-1",
      notebaseConnection: connection,
    })
    expect(migrated.selectionToolbar.saveSuggestion).toEqual({
      enabled: true,
      actionId: "default-dictionary",
    })
    expect(migrated.selectionToolbar.customActions).toEqual([])
  })

  it("preserves Save Suggestion state and an existing fixed action selection", () => {
    const oldConfig = config(currentDictionary, [
      {
        ...currentDictionary,
        id: "custom-save-action",
        name: "Custom Save",
      },
    ])
    oldConfig.selectionToolbar.saveSuggestion = {
      enabled: false,
      actionId: "custom-save-action",
    }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated.selectionToolbar.saveSuggestion).toEqual({
      enabled: false,
      actionId: "custom-save-action",
    })
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toEqual(migrated)
  })

  it("repairs a dangling Save Suggestion action id without mutating its input", () => {
    const oldConfig = config(currentDictionary)
    oldConfig.selectionToolbar.saveSuggestion = {
      enabled: false,
      actionId: "missing-action",
    }
    const snapshot = structuredClone(oldConfig)

    const migrated = migrate(oldConfig)

    expect(migrated.selectionToolbar.saveSuggestion).toEqual({
      enabled: false,
      actionId: "default-dictionary",
    })
    expect(oldConfig).toEqual(snapshot)
    expect(migrate(migrated)).toEqual(migrated)
  })

  it.each([undefined, null, [], { enabled: "yes" }])(
    "repairs a missing or malformed Save Suggestion config without mutating its input",
    (saveSuggestion) => {
      const oldConfig = config(currentDictionary)
      if (saveSuggestion === undefined) {
        delete oldConfig.selectionToolbar.saveSuggestion
      } else {
        oldConfig.selectionToolbar.saveSuggestion = saveSuggestion
      }
      const snapshot = structuredClone(oldConfig)

      const migrated = migrate(oldConfig)

      expect(migrated.selectionToolbar.saveSuggestion).toEqual({
        enabled: true,
        actionId: "default-dictionary",
      })
      expect(oldConfig).toEqual(snapshot)
      expect(migrate(migrated)).toEqual(migrated)
    },
  )

  it("preserves a modified enabled Dictionary as custom and disables the built-in", () => {
    const migrated = migrate(
      config({
        ...currentDictionary,
        systemPrompt: "My custom prompt",
        notebaseConnection: connection,
      }),
    )

    expect(migrated.selectionToolbar.builtInActions.dictionary).toEqual({
      enabled: false,
      providerId: "provider-1",
    })
    expect(migrated.selectionToolbar.customActions[0]).toMatchObject({
      id: "migrated-default-dictionary",
      enabled: true,
      systemPrompt: "My custom prompt",
      notebaseConnection: connection,
    })
  })

  it("rekeys an explicit Save Suggestion reference with a modified legacy Dictionary", () => {
    const oldConfig = config({
      ...currentDictionary,
      systemPrompt: "My custom prompt",
    })
    oldConfig.selectionToolbar.saveSuggestion.actionId = "default-dictionary"

    const migrated = migrate(oldConfig)

    expect(migrated.selectionToolbar.customActions[0].id).toBe("migrated-default-dictionary")
    expect(migrated.selectionToolbar.saveSuggestion.actionId).toBe("migrated-default-dictionary")
    expect(migrate(migrated)).toEqual(migrated)
  })

  it("preserves a modified disabled Dictionary and enables the built-in", () => {
    const migrated = migrate(config({ ...currentDictionary, enabled: false, prompt: "My prompt" }))

    expect(migrated.selectionToolbar.builtInActions.dictionary.enabled).toBe(true)
    expect(migrated.selectionToolbar.customActions[0]).toMatchObject({
      id: "migrated-default-dictionary",
      enabled: false,
      prompt: "My prompt",
    })
  })

  it("restores a deleted Dictionary as disabled", () => {
    const migrated = migrate(config(null))

    expect(migrated.selectionToolbar.builtInActions.dictionary).toEqual({
      enabled: false,
      providerId: "read-frog-free-ai",
    })
  })

  it("keeps a connected official legacy-schema Dictionary as custom", () => {
    const legacy = {
      id: "default-dictionary",
      name: "Dictionary",
      enabled: true,
      icon: "tabler:book-2",
      providerId: "provider-1",
      systemPrompt:
        "You are a dictionary assistant for language learners. Given a term and its surrounding paragraphs, provide a comprehensive and concise dictionary entry. When a term has multiple meanings, focus on the contextual meaning. Return the term in its base/canonical form. Respond in {{targetLanguage}}.",
      prompt:
        "Term: {{selection}}\nParagraphs: {{paragraphs}}\nTarget language: {{targetLanguage}}",
      outputSchema: [
        {
          id: "default-dictionary-term",
          name: "Term",
          type: "string",
          description: "",
          speaking: true,
        },
        {
          id: "default-dictionary-definition",
          name: "Definition",
          type: "string",
          description: "",
          speaking: false,
        },
        {
          id: "default-dictionary-context",
          name: "Paragraphs",
          type: "string",
          description: "",
          speaking: true,
        },
        {
          id: "default-dictionary-examples",
          name: "Examples",
          type: "string",
          description: "",
          speaking: false,
        },
        {
          id: "default-dictionary-synonyms",
          name: "Synonyms",
          type: "string",
          description: "",
          speaking: false,
        },
        {
          id: "default-dictionary-antonyms",
          name: "Antonyms",
          type: "string",
          description: "",
          speaking: false,
        },
      ],
      notebaseConnection: connection,
    }
    const migrated = migrate(config(legacy))

    expect(migrated.selectionToolbar.builtInActions.dictionary.enabled).toBe(false)
    expect(migrated.selectionToolbar.customActions[0]).toMatchObject({
      id: "migrated-default-dictionary",
      notebaseConnection: connection,
    })

    const { notebaseConnection: _connection, ...unconnectedLegacy } = legacy
    const pendingFingerprint = JSON.stringify(
      unconnectedLegacy.outputSchema.map(({ id, name, type }) => ({ id, name, type })),
    )
    const safelyMigrated = migrateWithPendingDictionarySave(config(unconnectedLegacy), {
      actionId: "default-dictionary",
      outputSchemaFingerprint: pendingFingerprint,
    })

    expect(safelyMigrated.selectionToolbar.builtInActions.dictionary.enabled).toBe(false)
    expect(safelyMigrated.selectionToolbar.customActions[0]).toMatchObject({
      id: "migrated-default-dictionary",
      outputSchema: unconnectedLegacy.outputSchema,
    })
    expect(
      migrateWithPendingDictionarySave(safelyMigrated, {
        actionId: "default-dictionary",
        outputSchemaFingerprint: pendingFingerprint,
      }),
    ).toEqual(safelyMigrated)
  })

  it("rekeys an explicit Save Suggestion reference on the pending-save safety path", () => {
    const oldConfig = config(currentDictionary)
    oldConfig.selectionToolbar.saveSuggestion.actionId = "default-dictionary"
    const pendingFingerprint = JSON.stringify(
      currentDictionary.outputSchema.map(({ id, name, type }) => ({ id, name, type })),
    )

    const migrated = migrateWithPendingDictionarySave(oldConfig, {
      actionId: "default-dictionary",
      outputSchemaFingerprint: pendingFingerprint,
    })

    expect(migrated.selectionToolbar.saveSuggestion.actionId).toBe("migrated-default-dictionary")
    expect(migrateWithPendingDictionarySave(migrated, null)).toEqual(migrated)
  })

  it("preserves the exact pending owner even when its output field ids are current", () => {
    const pending = {
      actionId: "default-dictionary",
      outputSchemaFingerprint: JSON.stringify(
        currentDictionary.outputSchema.map(({ id, name, type }) => ({ id, name, type })),
      ),
    }
    const oldConfig = config(currentDictionary)
    const rekeyedActionId = getPendingDictionaryRekeyedActionId(oldConfig, pending)
    const migrated = migrateWithPendingDictionarySave(oldConfig, pending)

    expect(rekeyedActionId).toBe("migrated-default-dictionary")
    expect(migrated.selectionToolbar.builtInActions.dictionary.enabled).toBe(false)
    expect(migrated.selectionToolbar.customActions[0]).toMatchObject({
      id: rekeyedActionId,
      outputSchema: currentDictionary.outputSchema,
    })
  })

  it("preserves the deterministic pending owner when another custom action has the same schema", () => {
    const pending = {
      actionId: "default-dictionary",
      outputSchemaFingerprint: JSON.stringify(
        currentDictionary.outputSchema.map(({ id, name, type }) => ({ id, name, type })),
      ),
    }
    const sameSchemaCopy = {
      ...currentDictionary,
      id: "dictionary-copy",
      name: "Dictionary copy",
    }
    const oldConfig = config({ ...currentDictionary, systemPrompt: "My custom prompt" }, [
      sameSchemaCopy,
    ])
    const rekeyedActionId = getPendingDictionaryRekeyedActionId(oldConfig, pending)
    const migrated = migrateWithPendingDictionarySave(oldConfig, pending)

    expect(rekeyedActionId).toBe("migrated-default-dictionary")
    expect(migrated.selectionToolbar.customActions.map((action: any) => action.id)).toEqual([
      "migrated-default-dictionary",
      "dictionary-copy",
    ])
  })

  it("keeps an official Dictionary with incompatible connection mappings as custom", () => {
    const migrated = migrate(
      config({
        ...currentDictionary,
        notebaseConnection: {
          ...connection,
          mappings: [
            {
              ...connection.mappings[0],
              localFieldId: "removed-dictionary-field",
            },
          ],
        },
      }),
    )

    expect(migrated.selectionToolbar.builtInActions.dictionary).toEqual({
      enabled: false,
      providerId: "provider-1",
    })
    expect(migrated.selectionToolbar.customActions[0]).toMatchObject({
      id: "migrated-default-dictionary",
      notebaseConnection: {
        mappings: [{ localFieldId: "removed-dictionary-field" }],
      },
    })
  })

  it("falls back to built-in AI for an invalid inherited provider", () => {
    const migrated = migrate(
      config({ ...currentDictionary, providerId: "missing-provider", systemPrompt: "modified" }),
    )

    expect(migrated.selectionToolbar.builtInActions.dictionary.providerId).toBe("read-frog-free-ai")
    expect(migrated.selectionToolbar.customActions[0].providerId).toBe("read-frog-free-ai")
  })

  it("uses a collision-safe deterministic custom id and is idempotent", () => {
    const collision = {
      ...currentDictionary,
      id: "migrated-default-dictionary",
      name: "Existing",
    }
    const original = config({ ...currentDictionary, systemPrompt: "modified" }, [collision])
    original.selectionToolbar.saveSuggestion.actionId = "default-dictionary"
    const snapshot = structuredClone(original)
    const first = migrate(original)
    const second = migrate(first)

    expect(original).toEqual(snapshot)
    expect(first.selectionToolbar.customActions[0].id).toBe("migrated-default-dictionary-2")
    expect(first.selectionToolbar.saveSuggestion.actionId).toBe("migrated-default-dictionary-2")
    expect(second).toEqual(first)
  })

  it("leaves malformed shapes unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate([])).toEqual([])
    expect(migrate({})).toEqual({})
    expect(migrate({ selectionToolbar: { customActions: null } })).toEqual({
      selectionToolbar: { customActions: null },
    })
  })
})
