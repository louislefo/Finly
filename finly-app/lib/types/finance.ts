export interface User {
  id: string
  email: string
  full_name: string
  avatar_seed?: string
  role?: string
  language?: "en" | "fr" | string
  is_active?: boolean
  auto_sync_enabled?: boolean
  sync_interval_hours?: number
  sync_time?: string
  created_at?: string
}

export interface SubcategoryDetail {
  id?: string | null
  name: string
  parent_name: string
  icon?: string
  color?: string
  is_custom?: boolean
}

export interface CategoryItem {
  id: string
  name: string
  icon?: string
  color?: string
  subcategories: string[]
  subcategories_details?: SubcategoryDetail[]
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
  bank_name?: string
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
  has_password?: boolean
  error_message?: string
  custom_params?: Record<string, string>
  created_at?: string
  last_synced_at?: string
}

export interface BankConfigFileChoice {
  value: string
  label: string
}

export interface BankConfigField {
  name: string
  label: string
  type: "text" | "select"
  required?: boolean
  default?: string
  placeholder?: string
  choices?: BankConfigFileChoice[]
}

export interface SupportedBank {
  id: string
  name: string
  desc?: string
  color?: string
  logo?: string
  config_fields?: BankConfigField[]
}

export interface BankChallengeField {
  id: string
  label: string
  type?: string
}

export interface BankChallengeResponse {
  status: "connected" | "2fa_required" | "pending" | "expired" | "cancelled" | "error"
  challenge_id?: string
  challenge_type?: "otp" | "app_validation"
  backend_name?: string
  module?: string
  bank_name?: string
  message?: string
  fields?: BankChallengeField[]
  accounts_count?: number
  extracted_data?: any[]
  custom_params?: Record<string, string>
  sync?: SyncResult
}

export interface BankHealthItem {
  connection_id: string
  bank_name: string
  module_name: string
  login?: string
  status: string
  has_password: boolean
  module_version?: string
  last_synced_at?: string
}

export interface BankHealthReport {
  status: string
  total_connections: number
  connections: BankHealthItem[]
}

export interface BankModuleStatus {
  id: string
  name: string
  installed: boolean
  version: string
  logo: string
}

export interface BankSyncError {
  connection_id?: string
  bank_name: string
  module_name: string
  login?: string
  backend_name?: string
  status: string
  message: string
}

export interface SyncResult {
  status: "success" | "warning" | "error"
  message?: string
  synced_accounts?: number
  new_transactions?: number
  errors?: BankSyncError[]
  result?: any
}

export interface Transaction {
  id: string
  merchant: string
  rawLabel?: string
  raw_label?: string
  date: string
  time?: string
  amount: number
  category: string
  subcategory?: string
  tags?: string[]
  matched_rule_id?: string
  category_confidence?: number
  is_low_confidence?: boolean
  is_user_classified?: boolean
  is_excluded_from_budget?: boolean
  account: string
  account_id?: string
  account_type?: string
  bank?: string
  project?: string
  logo_url?: string
  status?: string
}

export type RuleMatchType = "contains" | "exact" | "regex" | "starts_with" | "ends_with"
export type RuleApplyField = "all" | "raw_label" | "merchant_name"
export type RuleAmountType = "any" | "expense" | "income"

export interface CategorizationRule {
  id: string
  name: string
  is_active: boolean
  priority: number
  pattern: string
  match_type: RuleMatchType
  apply_to_field: RuleApplyField
  account_id?: string | null
  account_name?: string | null
  amount_type: RuleAmountType
  min_amount?: number | null
  max_amount?: number | null
  category: string
  subcategory?: string | null
  tags?: string[]
  is_excluded_from_budget: boolean
  mark_as_transfer: boolean
  logo_url?: string | null
  matched_count?: number
  created_at?: string
  updated_at?: string
}

export interface RuleTestResponse {
  matched_count: number
  pattern: string
  match_type: string
  samples: {
    id: string
    date: string
    amount: number
    raw_label: string
    merchant_name: string
    current_category: string
    current_subcategory?: string
    is_user_classified: boolean
  }[]
}

export interface BatchApplyRulesResponse {
  status: string
  message: string
  total_scanned: number
  matched_count: number
  updated_count: number
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

export interface AdminStats {
  system: {
    version: string
    project_name: string
    database_size_bytes: number
    database_size_mb: number
    scheduler_running: boolean
    sync_interval_hours: number
  }
  metrics: {
    total_users: number
    active_users: number
    admin_users: number
    total_bank_connections: number
    total_accounts: number
    total_transactions: number
    total_budgets: number
    total_projects: number
    total_balance: number
  }
}

export interface AdminUserItem {
  id: string
  email: string
  full_name: string
  avatar_seed?: string | null
  role: string
  is_active: boolean
  auto_sync_enabled: boolean
  sync_interval_hours: number
  sync_time: string
  created_at: string | null
  accounts_count: number
  bank_connections_count: number
  transactions_count: number
  total_balance: number
}

export interface VersionCheckInfo {
  current_version: string
  latest_version: string
  has_update: boolean
  release_title?: string
  release_notes?: string
  release_url?: string
  published_at?: string
  download_url?: string
  platform: string
  is_desktop: boolean
  is_container: boolean
  container_update_cmd: string
}

export interface UpdateDownloadStatus {
  status: "idle" | "downloading" | "ready" | "error"
  progress_percent: number
  downloaded_bytes: number
  total_bytes: number
  error_message?: string | null
  version?: string | null
}

export interface StockQuote {
  symbol: string
  name: string
  asset_type: "stock" | "etf" | "crypto" | "index" | "commodity"
  sector?: string
  price: number
  change: number
  change_percent: number
  currency: string
  day_high?: number
  day_low?: number
  high_52w?: number
  low_52w?: number
  volume?: number
  market_cap?: number
  pe_ratio?: number
  dividend_yield?: number
}

export interface StockHistoryPoint {
  time: number
  label: string
  price: number
  volume?: number
}

export interface InvestmentHolding {
  id: string
  symbol: string
  name: string
  asset_type: string
  quantity: number
  buy_price: number
  current_price: number
  total_value: number
  total_cost: number
  unrealized_pnl: number
  unrealized_pnl_percent: number
  daily_change: number
  daily_change_percent: number
  currency: string
  sector?: string
  weight_percent?: number
  account_id?: string
  notes?: string
  updated_at?: string
}

export interface PortfolioSummary {
  total_value: number
  total_cost: number
  unrealized_pnl: number
  unrealized_pnl_percent: number
  daily_change: number
  daily_change_percent: number
  holdings_count: number
  allocation_by_type: { type: string; value: number; percent: number }[]
  allocation_by_sector: { sector: string; value: number; percent: number }[]
}

export interface OllamaStatus {
  connected: boolean
  base_url: string
  version?: string | null
  models: string[]
  default_model: string
  fallback_model: string
  active_model?: string | null
  is_model_available: boolean
  is_installed_locally?: boolean
  os: string
}

export type AssistantStatus = OllamaStatus

export interface OllamaInstallGuide {
  os: string
  title: string
  download_url: string
  command: string
  instructions: string
}

export interface AssistantStatusResponse {
  status: string
  ollama: OllamaStatus
  install_guide: OllamaInstallGuide
}

export interface AssistantMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: string
}

export interface QuickPrompt {
  label: string
  prompt: string
}

export type AIProviderType = "ollama" | "openai" | "anthropic" | "mistral" | "deepseek" | "custom"

export interface AISettingsConfig {
  enabled: boolean
  mode: "disabled" | "local" | "cloud"
  provider: AIProviderType
  apiKey?: string
  model?: string
  baseUrl?: string
}

export interface ProviderTestResponse {
  success: boolean
  provider?: string
  model?: string
  message?: string
  error?: string
  status_code?: number
}

export interface EngineInstallResponse {
  status: string
  os: string
  message?: string
  manual_url?: string
  error?: string
}

export type LoanType = "mortgage" | "student" | "auto" | "consumer" | "personal" | "other"
export type LoanRateType = "fixed" | "variable"

export interface Loan {
  id: string
  name: string
  loan_type: LoanType
  lender_name?: string
  principal_amount: number
  interest_rate: number
  insurance_rate: number
  duration_months: number
  start_date: string
  end_date?: string
  monthly_payment: number
  monthly_principal_interest?: number
  monthly_insurance?: number
  rate_type: LoanRateType
  linked_project_id?: string
  linked_account_id?: string
  notes?: string
  created_at?: string
  updated_at?: string
  // Live computed status
  elapsed_months: number
  remaining_months: number
  remaining_balance: number
  capital_amortized: number
  interest_paid_to_date: number
  interest_remaining: number
  insurance_paid_to_date: number
  insurance_remaining: number
  total_interest: number
  total_insurance: number
  total_cost: number
  completion_percentage: number
}

export interface AmortizationScheduleItem {
  period: number
  date: string
  beginning_balance: number
  principal_payment: number
  interest_payment: number
  insurance_payment: number
  total_payment: number
  ending_balance: number
  cumulative_principal: number
  cumulative_interest: number
  is_past: boolean
}

export interface LoanScheduleResponse {
  loan_id: string
  loan_name: string
  total_periods: number
  schedule: AmortizationScheduleItem[]
}

export interface EarlyRepaymentSimulationRequest {
  repayment_amount: number
  repayment_month?: number
  strategy?: "reduce_duration" | "reduce_payment"
  penalty_rate_pct?: number
}

export interface EarlyRepaymentSimulationResult {
  strategy: "reduce_duration" | "reduce_payment"
  repayment_amount: number
  repayment_month: number
  penalty_amount: number
  balance_before: number
  balance_after: number
  original_remaining_months: number
  new_remaining_months: number
  months_saved: number
  years_saved: number
  current_monthly_payment: number
  new_monthly_payment: number
  monthly_payment_change: number
  interest_saved: number
  insurance_saved: number
  total_gross_savings: number
  net_savings: number
}

export interface LoansSummary {
  total_loans_count: number
  total_initial_principal: number
  total_remaining_balance: number
  total_capital_amortized: number
  total_monthly_payments: number
  total_interest_remaining: number
  total_insurance_remaining: number
  average_interest_rate: number
  breakdown_by_type: Record<string, { count: number; total_remaining: number; monthly_payment: number }>
}
