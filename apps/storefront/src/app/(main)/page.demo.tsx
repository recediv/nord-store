import type { Metadata } from "next"
import { demoHomeData } from "@lib/nord/demo-data"
import Home from "@modules/nord/home"

export const metadata: Metadata = {
  alternates: { canonical: "/" },
}

export default function DemoHomePage() {
  return <Home home={demoHomeData()} />
}
