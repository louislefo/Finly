import { PatrimoineView } from "@/components/views/patrimoine-view"

export const metadata = {
  title: "Patrimoine & Allocation — Finly",
  description: "Synthèse de votre patrimoine net, répartition par classes d'actifs et évolution financière",
}

export default function PatrimoinePage() {
  return <PatrimoineView />
}
