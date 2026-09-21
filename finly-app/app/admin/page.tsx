import { redirect } from "next/navigation"

export const metadata = {
  title: "Administration — Finly",
  description: "Panneau d'administration, métriques globales et gestion des utilisateurs",
}

export default function AdminPage() {
  redirect("/compte?tab=admin")
}
