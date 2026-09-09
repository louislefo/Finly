import { AdminView } from "@/components/views/admin-view"

export const metadata = {
  title: "Administration — Finly",
  description: "Panneau d'administration, métriques globales et gestion des utilisateurs",
}

export default function AdminPage() {
  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-[#09090B] text-white">
      <AdminView />
    </main>
  )
}
