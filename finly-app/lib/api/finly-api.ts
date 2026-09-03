import { Account, Transaction, Project, User, CategoryItem, BudgetSummary } from "@/lib/types/finance"

const API_BASE_URL = typeof window !== "undefined"
  ? (process.env.NEXT_PUBLIC_API_URL || "/api/v1")
  : (process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000/api/v1")

function getAuthHeaders(): HeadersInit {
  if (typeof window === "undefined") return { "Content-Type": "application/json" }
  const token = localStorage.getItem("finly_token")
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export const FinlyAPI = {
  // 0. Authentication
  async register(data: { email: string; password: string; full_name: string }): Promise<{ access_token: string; user: User }> {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Erreur lors de l'inscription.")
    }
    const result = await res.json()
    if (typeof window !== "undefined") {
      localStorage.setItem("finly_token", result.access_token)
      localStorage.setItem("finly_user", JSON.stringify(result.user))
    }
    return result
  },

  async login(data: { email: string; password: string }): Promise<{ access_token: string; user: User }> {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Identifiants invalides.")
    }
    const result = await res.json()
    if (typeof window !== "undefined") {
      localStorage.setItem("finly_token", result.access_token)
      localStorage.setItem("finly_user", JSON.stringify(result.user))
    }
    return result
  },

  async getMe(): Promise<User | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: getAuthHeaders(),
        cache: "no-store",
      })
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  },

  async changePassword(params: { current_password: string; new_password: string }): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(params),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Erreur lors de la modification du mot de passe.")
    }
    return await res.json()
  },

  logout(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem("finly_token")
      localStorage.removeItem("finly_user")
    }
  },

  // 1. Categories
  async getCategories(): Promise<CategoryItem[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/categories/`, {
        headers: getAuthHeaders(),
        cache: "no-store",
      })
      if (!res.ok) return []
      const data = await res.json()
      return data.categories || []
    } catch {
      return []
    }
  },

  async createCategory(params: {
    name: string
    parent_name?: string
    icon?: string
    color?: string
  }): Promise<{ status: string; category: any }> {
    const res = await fetch(`${API_BASE_URL}/categories/`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(params),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Erreur lors de la création de la catégorie.")
    }
    return await res.json()
  },

  async deleteCategory(categoryId: string): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE_URL}/categories/${categoryId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error("Erreur lors de la suppression de la catégorie.")
    return await res.json()
  },

  // 2. Budgets
  async getBudgets(params?: string | {
    month?: string
    account_type?: string
    account_id?: string
    exclude_transfers?: boolean
  }): Promise<BudgetSummary> {
    try {
      const q = new URLSearchParams()
      if (typeof params === "string") {
        if (params) q.set("month", params)
      } else if (params) {
        if (params.month) q.set("month", params.month)
        if (params.account_type) q.set("account_type", params.account_type)
        if (params.account_id) q.set("account_id", params.account_id)
        if (params.exclude_transfers !== undefined) q.set("exclude_transfers", String(params.exclude_transfers))
      }
      const qs = q.toString() ? `?${q.toString()}` : ""
      const res = await fetch(`${API_BASE_URL}/budgets/${qs}`, {
        headers: getAuthHeaders(),
        cache: "no-store",
      })
      if (!res.ok) return { month: "", total_budget: 0, total_spent: 0, remaining_budget: 0, items: [] }
      return await res.json()
    } catch {
      return { month: "", total_budget: 0, total_spent: 0, remaining_budget: 0, items: [] }
    }
  },

  async setBudget(params: {
    category: string
    monthly_limit: number
  }): Promise<{ status: string; budget: any }> {
    const res = await fetch(`${API_BASE_URL}/budgets/`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(params),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Erreur lors de la configuration du budget.")
    }
    return await res.json()
  },

  async deleteBudget(category: string): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE_URL}/budgets/${encodeURIComponent(category)}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error("Erreur suppression budget")
    return await res.json()
  },

  // 3. Accounts
  async getAccounts(): Promise<{ total_balance: number; accounts: Account[] }> {
    try {
      const res = await fetch(`${API_BASE_URL}/accounts/`, {
        headers: getAuthHeaders(),
        cache: "no-store",
      })
      if (!res.ok) return { total_balance: 0, accounts: [] }
      const data = await res.json()
      return {
        total_balance: data.total_balance ?? 0,
        accounts: data.accounts ?? [],
      }
    } catch {
      return { total_balance: 0, accounts: [] }
    }
  },

  async deleteAccount(accountId: string): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE_URL}/accounts/${accountId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error("Erreur suppression compte")
    return await res.json()
  },

  async deleteBank(bankName: string): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE_URL}/accounts/by-bank/${encodeURIComponent(bankName)}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error("Erreur suppression banque")
    return await res.json()
  },

  // 4. Transactions
  async getTransactions(params?: {
    account_id?: string
    account_type?: string
    category?: string
    search?: string
  }): Promise<{ total: number; transactions: Transaction[] }> {
    try {
      const query = new URLSearchParams()
      if (params?.account_id) query.set("account_id", params.account_id)
      if (params?.account_type) query.set("account_type", params.account_type)
      if (params?.category) query.set("category", params.category)
      if (params?.search) query.set("search", params.search)

      const res = await fetch(`${API_BASE_URL}/transactions/?${query.toString()}`, {
        headers: getAuthHeaders(),
        cache: "no-store",
      })
      if (!res.ok) return { total: 0, transactions: [] }
      return await res.json()
    } catch {
      return { total: 0, transactions: [] }
    }
  },

  async updateTransactionCategory(
    txId: string,
    params: { category: string; subcategory?: string; apply_to_all_merchant?: boolean }
  ): Promise<{ status: string; transaction_id: string; category: string; subcategory?: string; updated_count: number; merchant?: string }> {
    const res = await fetch(`${API_BASE_URL}/transactions/${txId}/category`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(params),
    })
    if (!res.ok) throw new Error("Erreur lors de la mise à jour de la catégorie")
    return await res.json()
  },

  async getCompanyInfo(txId: string): Promise<{
    found: boolean
    nom_complet?: string
    siren?: string
    siret?: string
    activite_label?: string
    activite_principale?: string
    adresse?: string
    commune?: string
    nature_juridique?: string
    categorie_entreprise?: string
    date_creation?: string
    logo_url?: string
    domain?: string
  }> {
    try {
      const res = await fetch(`${API_BASE_URL}/transactions/${txId}/company-info`, {
        headers: getAuthHeaders(),
        cache: "default",
      })
      if (!res.ok) return { found: false }
      return await res.json()
    } catch {
      return { found: false }
    }
  },

  // 5. Projects
  async getProjects(): Promise<Project[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/projects/`, {
        headers: getAuthHeaders(),
        cache: "no-store",
      })
      if (!res.ok) return []
      return await res.json()
    } catch {
      return []
    }
  },

  // 6. Connect Bank via Woob Local Engine
  async connectWoobBank(params: {
    module: string
    login: string
    password?: string
    custom_params?: Record<string, string>
  }): Promise<{ status: string; message?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/woob/connect`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(params),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detail || "Erreur lors de la connexion bancaire")
      }
      return await res.json()
    } catch (err: any) {
      if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError") || err.message.includes("fetch")) {
        throw new Error("Le serveur backend n'est pas accessible. Veuillez démarrer le backend FastAPI sur le port 8000.")
      }
      throw err
    }
  },

  // 7. Trigger Immediate Sync
  async triggerSync(): Promise<{ status: string; data?: any; message?: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/woob/sync`, {
        method: "POST",
        headers: getAuthHeaders(),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detail || "Erreur lors de la synchronisation bancaire.")
      }
      return await res.json()
    } catch (err: any) {
      if (err.message && !err.message.includes("Failed to fetch") && !err.message.includes("fetch")) {
        throw err
      }
      throw new Error("Impossible de joindre le serveur backend pour la synchronisation.")
    }
  },

  // 8. Import JSON Backup
  async importJsonBackup(payload: Record<string, any>): Promise<{
    status: string
    message: string
    imported: {
      accounts: number
      transactions: number
      projects: number
      budgets: number
    }
  }> {
    const res = await fetch(`${API_BASE_URL}/sync/import-json`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Erreur lors de l'import de la sauvegarde JSON.")
    }
    return await res.json()
  },
}
