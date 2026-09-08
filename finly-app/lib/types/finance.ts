export interface User {
  id: string
  email: string
  full_name: string
  role?: string
  auto_sync_enabled?: boolean
  sync_interval_hours?: number
  sync_time?: string
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
  excluded_spent?: number
  excluded_count?: number
  transactions: {
    id: string
    merchant: string
    raw_label: string
    date: string
    amount: number
    category: string
    subcategory?: string
    is_excluded_from_budget?: boolean
  }[]
}

export interface BudgetSummary {
  month: string
  total_budget: number
  total_spent: number
  total_income?: number
  net_cashflow?: number
  remaining_budget: number
  total_excluded_amount?: number
  excluded_transactions_count?: number
  total_savings_transfers?: number
  savings_transfers?: {
    id: string
    merchant: string
    raw_label: string
    date: string
    amount: number
    category: string
    subcategory?: string
  }[]
  incomes?: {
    category: string
    amount: number
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
  }[]
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
  updated_at?: string
}

export interface BankConnection {
  id: string
  module_name: string
  bank_name: string
  login?: string
  backend_name?: string
  status: string
  created_at?: string
  last_synced_at?: string
}

export interface Transaction {
  id: string
  merchant: string
  rawLabel: string
  raw_label?: string
  date: string
  time: string
  amount: number
  category: string
  subcategory?: string
  is_user_classified?: boolean
  is_excluded_from_budget?: boolean
  account: string
  account_id?: string
  account_type?: string
  bank?: string
  project?: string
  logo_url?: string
}

export interface AddressSearchResult {
  label: string
  name: string
  postcode: string
  city: string
  citycode?: string
  context?: string
  latitude: number
  longitude: number
}

export interface RealEstateEstimate {
  estimated_value: number
  price_range: {
    low: number
    median: number
    high: number
  }
  price_per_m2: {
    low: number
    median: number
    high: number
  }
  surface_m2: number
  property_type: string
  location: {
    city: string
    postal_code?: string
    region?: string
  }
  market_trend_1y: number
  valuation_date: string
  confidence_index: string
}

export interface RealEstateData {
  propertyPrice: number
  downPayment: number
  loanAmount: number
  loanDurationYears: number
  interestRate: number
  insuranceRate?: number
  propertyType?: "apartment" | "house" | "building" | "parking" | "commercial" | "old" | "new"
  surfaceM2?: number
  address?: string
  city?: string
  postalCode?: string
  latitude?: number
  longitude?: number
  purchaseDate?: string
  currentEstimatedValue?: number
  estimatedPricePerM2?: number
  lastValuationDate?: string
  hasLoan?: boolean
  loanStartDate?: string
  monthlyPayment?: number
  totalInterest?: number
  totalInsurance?: number
  totalCost?: number
  remainingLoanBalance?: number
  capitalAmortized?: number
  isRental?: boolean
  monthlyRent?: number
  grossYield?: number
  notaryFees?: number
  debtRatioEstimated?: number
}

export interface MortgageRateDuration {
  duration_years: number
  rate_excellent: number
  rate_good: number
  rate_average: number
  monthly_per_10k: number
}

export interface MortgageRatesSummary {
  last_updated: string
  source: string
  market_rates: MortgageRateDuration[]
  usury_rates: { category: string; max_rate: number }[]
  reference_rates: {
    bce_refi_rate: number
    bce_deposit_rate: number
    livret_a_rate: number
    lep_rate: number
    avg_insurance_rate: number
    notary_fees_old_percent: number
    notary_fees_new_percent: number
    max_debt_ratio_percent: number
  }
}

export interface Project {
  id: string
  name: string
  description?: string
  projectType?: "savings" | "real_estate" | "general" | "standard"
  targetAmount: number
  currentAmount: number
  monthlyContribution?: number
  deadline: string
  category: string
  status: "future" | "in_progress" | "completed" | "paused" | "near"
  linkedAccountId?: string
  linkedAccountName?: string
  realEstateData?: RealEstateData
  createdAt?: string
}

export interface ExportOptions {
  format: "xlsx" | "csv"
  period: "current_month" | "last_3_months" | "year_2026" | "all"
  includeFormulas: boolean
  scope: "all" | "transactions" | "projects" | "summary"
}
