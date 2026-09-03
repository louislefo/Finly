export interface User {
  id: string
  email: string
  full_name: string
  role?: string
}

export interface CategoryItem {
  id: string
  name: string
  icon?: string
  color?: string
  subcategories: string[]
  is_custom?: boolean
}

export interface BudgetItem {
  category: string
  monthly_limit: number
  spent: number
  remaining: number
  percentage: number
  transactions_count: number
  transactions: {
    id: string
    merchant: string
    raw_label: string
    date: string
    amount: number
    category: string
    subcategory?: string
  }[]
}

export interface BudgetSummary {
  month: string
  total_budget: number
  total_spent: number
  remaining_budget: number
  items: BudgetItem[]
}

export interface Account {
  id: string
  bank: string
  name?: string
  type: string
  balance: number
  color?: string
  accountNumber?: string
  iban?: string
}

export interface Transaction {
  id: string
  merchant: string
  rawLabel: string
  date: string
  time: string
  amount: number
  category: string
  subcategory?: string
  is_user_classified?: boolean
  account: string
  account_id?: string
  account_type?: string
  bank?: string
  project?: string
}

export interface Project {
  id: string
  name: string
  description: string
  targetAmount: number
  currentAmount: number
  deadline: string
  category: string
  status: "in_progress" | "completed" | "near"
}

export interface ExportOptions {
  format: "xlsx" | "csv"
  period: "current_month" | "last_3_months" | "year_2026" | "all"
  includeFormulas: boolean
  scope: "all" | "transactions" | "projects" | "summary"
}
