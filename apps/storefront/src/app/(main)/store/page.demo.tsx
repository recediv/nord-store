import { Suspense } from "react"
import type { Metadata } from "next"
import { demoCatalog } from "@lib/nord/demo-data"
import { Catalog } from "@modules/nord/catalog"

export const dynamic = "force-static"
// The shared Catalog owns its React 19 metadata in SSR and after filtering.
export const metadata: Metadata = {
  title: null,
  robots: null,
  alternates: { canonical: null },
}

export default function DemoCatalogPage() {
  return (
    <Suspense
      fallback={
        <main className="container catalog-page">
          <h1>Каталог</h1>
        </main>
      }
    >
      <Catalog
        initial={demoCatalog(new URLSearchParams({ limit: "12" }))}
        query=""
      />
    </Suspense>
  )
}
