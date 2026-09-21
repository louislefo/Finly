import { BudgetView } from "@/components/views/budget-view"

export const metadata = {
  title: "Budgets & Répartition — Finly",
  description: "Suivi des budgets mensuels et répartition des dépenses par catégorie",
}

export default function BudgetPage() {
  return <BudgetView />
}
