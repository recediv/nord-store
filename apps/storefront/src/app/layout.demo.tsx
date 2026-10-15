import type { Metadata } from "next"
import { ViewTransitions } from "next-view-transitions"
import { demoConfig } from "@lib/nord/demo-data"
import { DemoProvider } from "@modules/nord/demo-provider"
import Shell from "@modules/nord/shell"
import { assetPath } from "@lib/nord/asset-path"
import "@modules/nord/styles/root.css"

export const dynamic = "force-static"

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_PATH || "/",
    process.env.NEXT_PUBLIC_BASE_URL || "http://127.0.0.1:4174",
  ),
  icons: { icon: assetPath("/favicon.svg") },
  title: { default: "NORD — вещи для вашего дома", template: "%s — NORD" },
  description:
    "Мебель, свет и предметы для дома с характером. Демонстрационный магазин NORD.",
}

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ViewTransitions>
      <html lang="ru">
        <body>
          <DemoProvider config={demoConfig}>
            <Shell>{children}</Shell>
          </DemoProvider>
        </body>
      </html>
    </ViewTransitions>
  )
}
