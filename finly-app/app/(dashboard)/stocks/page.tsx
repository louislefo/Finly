import { StocksView } from "@/components/views/stocks-view"

export const metadata = {
  title: "Bourse & Actions — Finly",
  description: "Cotations en direct des indices mondiaux, actions et ETF.",
}

export default function StocksPage() {
  return <StocksView />
}
