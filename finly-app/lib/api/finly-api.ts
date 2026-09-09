import {
  Account,
  BankConnection,
  Transaction,
  Project,
  User,
  CategoryItem,
  BudgetSummary,
  MortgageRatesSummary,
  AddressSearchResult,
  RealEstateEstimate,
  AdminStats,
  AdminUserItem,
} from "@/lib/types/finance"

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

  async updateSyncSettings(params: {
    auto_sync_enabled: boolean
    sync_interval_hours?: number
    sync_time?: string
  }): Promise<{ status: string; message: string; auto_sync_enabled: boolean; sync_interval_hours: number; sync_time: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/sync-settings`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(params),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Erreur lors de l'enregistrement des préférences.")
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

  async updateAccount(
    accountId: string,
    params: { name?: string; account_type?: string; color?: string }
  ): Promise<{ status: string; account: Account }> {
    const res = await fetch(`${API_BASE_URL}/accounts/${accountId}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(params),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Erreur lors de la mise à jour du compte.")
    }
    return await res.json()
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

  async getBankConnections(): Promise<BankConnection[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/woob/connections`, {
        headers: getAuthHeaders(),
        cache: "no-store",
      })
      if (!res.ok) return []
      return await res.json()
    } catch {
      return []
    }
  },

  async deleteBankConnection(connId: string): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE_URL}/woob/connections/${connId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Erreur lors de la suppression de la connexion bancaire.")
    }
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

  async toggleExcludeTransactionFromBudget(
    txId: string,
    isExcluded: boolean
  ): Promise<{ status: string; transaction_id: string; is_excluded_from_budget: boolean }> {
    const res = await fetch(`${API_BASE_URL}/transactions/${txId}/exclude-budget`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ is_excluded: isExcluded }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Erreur lors de la modification de l'exclusion de budget.")
    }
    return await res.json()
  },

  async updateTransactionLogo(
    txId: string,
    params: { logo_url: string | null; apply_to_all_merchant?: boolean }
  ): Promise<{ status: string; transaction_id: string; merchant?: string; logo_url?: string; updated_count: number }> {
    const res = await fetch(`${API_BASE_URL}/transactions/${txId}/logo`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(params),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Erreur lors de la mise à jour du logo.")
    }
    return await res.json()
  },

  async deleteTransaction(txId: string): Promise<{ status: string; message: string; transaction_id: string }> {
    const res = await fetch(`${API_BASE_URL}/transactions/${txId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Erreur lors de la suppression de la transaction.")
    }
    return await res.json()
  },

  async previewCsvTransactions(params: {
    csv_text: string
    custom_mapping?: Record<string, any>
  }): Promise<{
    status: string
    delimiter: string
    has_header: boolean
    columns: string[]
    detected_mapping: Record<string, any>
    total_count: number
    message?: string
    sample_transactions: any[]
    all_transactions: any[]
  }> {
    const res = await fetch(`${API_BASE_URL}/transactions/preview-csv`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(params),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Erreur lors de l'analyse du CSV.")
    }
    return await res.json()
  },

  async importCsvTransactions(params: {
    account_id?: string
    account_name?: string
    account_type?: string
    csv_text?: string
    custom_mapping?: Record<string, any>
    transactions?: any[]
  }): Promise<{
    status: string
    message: string
    account_id: string
    account_name: string
    imported_count: number
    updated_count: number
    total_processed: number
  }> {
    const res = await fetch(`${API_BASE_URL}/transactions/import-csv`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(params),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Erreur lors de l'importation des dépenses CSV.")
    }
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

  // 8. Import and Export JSON Backup
  async exportJsonBackup(): Promise<Record<string, any>> {
    const res = await fetch(`${API_BASE_URL}/sync/export-json`, {
      method: "GET",
      headers: getAuthHeaders(),
      cache: "no-store",
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Erreur lors de l'exportation des données.")
    }
    return await res.json()
  },

  async importJsonBackup(payload: Record<string, any>): Promise<{
    status: string
    message: string
    imported: {
      accounts: number
      transactions: number
      projects: number
      budgets: number
      categories?: number
      rules?: number
    }
    pending_connections?: Array<{
      id?: string
      backend_name?: string
      module_name: string
      bank_name: string
      login: string
    }>
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

  // 9. Projects API
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

  async createProject(payload: Partial<Project>): Promise<Project> {
    const body: Record<string, any> = {
      name: payload.name,
      target_amount: payload.targetAmount,
      current_amount: payload.currentAmount || 0,
      monthly_contribution: payload.monthlyContribution || 0,
      deadline: payload.deadline,
      category: payload.category || "Général",
      project_type: payload.projectType || "savings",
      status: payload.status || "in_progress",
      linked_account_id: payload.linkedAccountId || null,
      real_estate_data: payload.realEstateData || null,
      description: payload.description || null,
    }

    const res = await fetch(`${API_BASE_URL}/projects/`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Erreur lors de la création du projet.")
    }
    return await res.json()
  },

  async updateProject(projectId: string, payload: Partial<Project>): Promise<Project> {
    const body: Record<string, any> = {}
    if (payload.name !== undefined) body.name = payload.name
    if (payload.targetAmount !== undefined) body.target_amount = payload.targetAmount
    if (payload.currentAmount !== undefined) body.current_amount = payload.currentAmount
    if (payload.monthlyContribution !== undefined) body.monthly_contribution = payload.monthlyContribution
    if (payload.deadline !== undefined) body.deadline = payload.deadline
    if (payload.category !== undefined) body.category = payload.category
    if (payload.projectType !== undefined) body.project_type = payload.projectType
    if (payload.status !== undefined) body.status = payload.status
    if (payload.linkedAccountId !== undefined) body.linked_account_id = payload.linkedAccountId
    if (payload.realEstateData !== undefined) body.real_estate_data = payload.realEstateData
    if (payload.description !== undefined) body.description = payload.description

    const res = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Erreur lors de la modification du projet.")
    }
    return await res.json()
  },

  async addFundsToProject(projectId: string, amount: number, sourceAccountId?: string): Promise<Project> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}/funds`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ amount, source_account_id: sourceAccountId }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Erreur lors de l'ajout de fonds.")
    }
    return await res.json()
  },

  async deleteProject(projectId: string): Promise<{ status: string }> {
    const res = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    })
    if (!res.ok) throw new Error("Erreur lors de la suppression du projet.")
    return await res.json()
  },

  // 10. Rates API (Mortgage & Market rates)
  async getMortgageRates(): Promise<MortgageRatesSummary | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/rates/mortgage`, {
        headers: getAuthHeaders(),
        cache: "no-store",
      })
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  },

  // 11. Real Estate API (Valuation, Address Autocomplete & Amortization)
  async searchAddress(query: string): Promise<AddressSearchResult[]> {
    if (!query || query.trim().length < 2) return []
    try {
      const res = await fetch(`${API_BASE_URL}/real-estate/search-address?q=${encodeURIComponent(query)}`, {
        headers: getAuthHeaders(),
      })
      if (!res.ok) return []
      const data = await res.json()
      return data.results || []
    } catch {
      return []
    }
  },

  async estimateRealEstate(params: {
    address?: string
    postal_code?: string
    city?: string
    surface_m2: number
    property_type?: string
    lat?: number
    lon?: number
  }): Promise<RealEstateEstimate | null> {
    try {
      const q = new URLSearchParams()
      if (params.address) q.set("address", params.address)
      if (params.postal_code) q.set("postal_code", params.postal_code)
      if (params.city) q.set("city", params.city)
      q.set("surface_m2", params.surface_m2.toString())
      if (params.property_type) q.set("property_type", params.property_type)
      if (params.lat) q.set("lat", params.lat.toString())
      if (params.lon) q.set("lon", params.lon.toString())

      const res = await fetch(`${API_BASE_URL}/real-estate/estimate?${q.toString()}`, {
        headers: getAuthHeaders(),
      })
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  },

  async computeLoanAmortization(params: {
    loan_amount: number
    duration_years: number
    interest_rate: number
    insurance_rate?: number
    start_date?: string
  }): Promise<{
    monthly_payment: number
    monthly_principal_interest: number
    monthly_insurance: number
    total_interest: number
    total_insurance: number
    total_cost: number
    elapsed_months: number
    remaining_months: number
    remaining_loan_balance: number
    capital_amortized: number
  }> {
    const res = await fetch(`${API_BASE_URL}/real-estate/amortization`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(params),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Erreur lors du calcul d'amortissement.")
    }
    return await res.json()
  },

  // 10. Administration
  async getAdminStats(): Promise<AdminStats> {
    const res = await fetch(`${API_BASE_URL}/admin/stats`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Erreur lors de la récupération des statistiques d'administration.")
    }
    return await res.json()
  },

  async getAdminUsers(): Promise<{ status: string; users: AdminUserItem[] }> {
    const res = await fetch(`${API_BASE_URL}/admin/users`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Erreur lors de la récupération des utilisateurs.")
    }
    return await res.json()
  },

  async updateAdminUser(
    userId: string,
    data: { role?: string; is_active?: boolean; full_name?: string }
  ): Promise<{ status: string; message: string; user: any }> {
    const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Erreur lors de la mise à jour de l'utilisateur.")
    }
    return await res.json()
  },

  async resetAdminUserPassword(
    userId: string,
    newPassword: string
  ): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/reset-password`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ new_password: newPassword }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Erreur lors de la réinitialisation du mot de passe.")
    }
    return await res.json()
  },

  async deleteAdminUser(userId: string): Promise<{ status: string; message: string }> {
    const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Erreur lors de la suppression de l'utilisateur.")
    }
    return await res.json()
  },

  async triggerAdminSyncAll(): Promise<{ status: string; message: string; target_connections: number }> {
    const res = await fetch(`${API_BASE_URL}/admin/maintenance/sync-all`, {
      method: "POST",
      headers: getAuthHeaders(),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Erreur lors du déclenchement de la synchronisation.")
    }
    return await res.json()
  },

  async triggerAdminVacuum(): Promise<{
    status: string
    message: string
    database_size_bytes: number
    database_size_mb: number
  }> {
    const res = await fetch(`${API_BASE_URL}/admin/maintenance/vacuum`, {
      method: "POST",
      headers: getAuthHeaders(),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Erreur lors de l'optimisation de la base de données.")
    }
    return await res.json()
  },

  async impersonateUser(userId: string): Promise<{
    status: string
    access_token: string
    token_type: string
    user: User
    impersonated_by: { id: string; email: string; full_name: string }
  }> {
    const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/impersonate`, {
      method: "POST",
      headers: getAuthHeaders(),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Erreur lors de l'accès au compte utilisateur.")
    }
    return await res.json()
  },
}
