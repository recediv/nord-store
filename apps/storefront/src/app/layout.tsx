import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import { ViewTransitions } from "next-view-transitions"
import { getCatalogScope, storefrontData } from "@lib/nord/data"
import { bootstrapCart } from "@lib/nord/cart-actions"
import { NativeProvider } from "@modules/nord/native-provider"
import Shell from "@modules/nord/shell"
import { assetPath } from "@lib/nord/asset-path"
import "@modules/nord/styles/root.css"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  title: { default: "NORD — вещи для вашего дома", template: "%s — NORD" },
  description: "Мебель, свет и предметы для дома с характером.",
  icons: { icon: assetPath("/favicon.svg") },
  openGraph: { siteName: "NORD", locale: "ru_RU", type: "website" },
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const [config, saved, catalogScope] = await Promise.all([
    storefrontData(),
    bootstrapCart(),
    getCatalogScope(),
  ])
  return (
    <ViewTransitions>
      <html lang="ru" data-mode="light">
        <body>
          <NativeProvider
            config={config}
            catalogScope={catalogScope}
            initialCart={saved.cart}
            initialError={saved.error}
            initialRecovery={saved.pending}
          >
            <Shell>{props.children}</Shell>
          </NativeProvider>
        </body>
      </html>
    </ViewTransitions>
  )
}
