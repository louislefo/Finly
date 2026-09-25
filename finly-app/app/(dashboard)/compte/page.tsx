import { Suspense } from "react"
import { AccountView } from "@/components/views/account-view"

export const metadata = {
  title: "Banques & Comptes — Finly",
  description: "Gestion des établissements bancaires connectés, sous-comptes et paramètres de sécurité",
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#09090B]" />}>
      <AccountView />
    </Suspense>
  )
}
