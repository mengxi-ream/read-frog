import { i18n } from "#imports"

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-4 p-4">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">
            {i18n.t("splitTranslator.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {i18n.t("splitTranslator.description")}
          </p>
        </header>
      </main>
    </div>
  )
}
