import { AccountView } from "@/components/views/account-view"

export const metadata = {
  title: "Banques & Comptes — Finly",
  description: "Gestion des établissements bancaires connectés, sous-comptes et paramètres de sécurité",
}

export default function AccountPage() {
  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-[#09090B] text-white">
      <AccountView />
    </main>
  )
}
