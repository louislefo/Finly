import { BudgetView } from "@/components/views/budget-view"

export const metadata = {
  title: "Budgets & Répartition — Finly",
  description: "Suivi des budgets mensuels et répartition des dépenses par catégorie",
}

export default function BudgetPage() {
  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-[#09090B] text-white">
      <BudgetView />
    </main>
  )
}
