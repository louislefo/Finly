import { ForexView } from "@/components/views/forex-view"

export const metadata = {
  title: "Taux de Change & Devises — Finly",
  description: "Cotations en direct, convertisseur de devises et graphiques historiques officiels de la BCE via Frankfurter",
}

export default function DevisesPage() {
  return <ForexView />
}
