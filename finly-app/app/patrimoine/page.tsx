import { PatrimoineView } from "@/components/views/patrimoine-view"

export const metadata = {
  title: "Patrimoine & Allocation — Finly",
  description: "Synthèse de votre patrimoine net, répartition par classes d'actifs et évolution financière",
}

export default function PatrimoinePage() {
  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-[#09090B] text-white">
      <PatrimoineView />
    </main>
  )
}
