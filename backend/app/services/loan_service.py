import math
from datetime import datetime
from typing import List, Dict, Any, Optional


class LoanService:
    @staticmethod
    def calculate_monthly_payment(
        principal: float,
        annual_rate_pct: float,
        duration_months: int,
        insurance_rate_pct: float = 0.30,
    ) -> Dict[str, float]:
        """
        Calculates standard fixed-rate French loan installment breakdown:
        - Monthly principal & interest
        - Monthly insurance
        - Total monthly installment
        - Lifetime interest and insurance
        """
        if duration_months <= 0 or principal <= 0:
            return {
                "monthly_payment": 0.0,
                "monthly_principal_interest": 0.0,
                "monthly_insurance": 0.0,
                "total_interest": 0.0,
                "total_insurance": 0.0,
                "total_cost": 0.0,
            }

        r = (annual_rate_pct / 100.0) / 12.0
        n = duration_months
        monthly_insurance = (principal * (insurance_rate_pct or 0.0) / 100.0) / 12.0

        if r > 0:
            factor = (1.0 + r) ** n
            monthly_pi = principal * (r * factor) / (factor - 1.0)
        else:
            monthly_pi = principal / n

        total_pi = monthly_pi * n
        total_interest = max(0.0, total_pi - principal)
        total_insurance = monthly_insurance * n
        total_payment = monthly_pi + monthly_insurance

        return {
            "monthly_payment": round(total_payment, 2),
            "monthly_principal_interest": round(monthly_pi, 2),
            "monthly_insurance": round(monthly_insurance, 2),
            "total_interest": round(total_interest, 2),
            "total_insurance": round(total_insurance, 2),
            "total_cost": round(principal + total_interest + total_insurance, 2),
        }

    @staticmethod
    def _parse_start_date(start_date_str: str) -> tuple[int, int]:
        """Parses YYYY-MM or YYYY-MM-DD into (year, month)."""
        clean = (start_date_str or "").strip()
        parts = clean.split("-")
        try:
            year = int(parts[0])
            month = int(parts[1]) if len(parts) > 1 else 1
            return year, month
        except Exception:
            now = datetime.utcnow()
            return now.year, now.month

    @staticmethod
    def calculate_elapsed_months(start_date_str: str, now: Optional[datetime] = None) -> int:
        """Calculates elapsed months from start_date to now."""
        if not now:
            now = datetime.utcnow()
        start_y, start_m = LoanService._parse_start_date(start_date_str)
        return max(0, (now.year - start_y) * 12 + (now.month - start_m))

    @staticmethod
    def calculate_live_status(
        principal: float,
        annual_rate_pct: float,
        duration_months: int,
        insurance_rate_pct: float,
        start_date_str: str,
        now: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Computes real-time dynamic loan status (remaining debt, amortized capital, progress).
        """
        payment_info = LoanService.calculate_monthly_payment(
            principal, annual_rate_pct, duration_months, insurance_rate_pct
        )
        monthly_pi = payment_info["monthly_principal_interest"]
        monthly_ins = payment_info["monthly_insurance"]
        r = (annual_rate_pct / 100.0) / 12.0

        elapsed = LoanService.calculate_elapsed_months(start_date_str, now)
        elapsed = min(duration_months, elapsed)

        balance = principal
        interest_paid = 0.0

        for _ in range(elapsed):
            cur_interest = balance * r
            cur_principal = monthly_pi - cur_interest
            if cur_principal > balance:
                cur_principal = balance
            balance = max(0.0, balance - cur_principal)
            interest_paid += cur_interest

        remaining_balance = round(balance, 2)
        capital_amortized = round(principal - remaining_balance, 2)
        insurance_paid = round(elapsed * monthly_ins, 2)
        remaining_months = max(0, duration_months - elapsed)
        interest_remaining = max(0.0, round(payment_info["total_interest"] - interest_paid, 2))
        insurance_remaining = round(remaining_months * monthly_ins, 2)

        completion_pct = round((capital_amortized / principal) * 100.0, 1) if principal > 0 else 100.0

        start_y, start_m = LoanService._parse_start_date(start_date_str)
        total_end_months = (start_y * 12 + start_m - 1) + duration_months
        end_year = total_end_months // 12
        end_month = (total_end_months % 12) + 1
        end_date_str = f"{end_year:04d}-{end_month:02d}"

        return {
            "principal_amount": round(principal, 2),
            "interest_rate": annual_rate_pct,
            "insurance_rate": insurance_rate_pct,
            "duration_months": duration_months,
            "start_date": start_date_str,
            "end_date": end_date_str,
            "monthly_payment": payment_info["monthly_payment"],
            "monthly_principal_interest": monthly_pi,
            "monthly_insurance": monthly_ins,
            "total_interest": payment_info["total_interest"],
            "total_insurance": payment_info["total_insurance"],
            "total_cost": payment_info["total_cost"],
            "elapsed_months": elapsed,
            "remaining_months": remaining_months,
            "remaining_balance": remaining_balance,
            "capital_amortized": capital_amortized,
            "interest_paid_to_date": round(interest_paid, 2),
            "interest_remaining": interest_remaining,
            "insurance_paid_to_date": insurance_paid,
            "insurance_remaining": insurance_remaining,
            "completion_percentage": min(100.0, completion_pct),
        }

    @staticmethod
    def generate_amortization_schedule(
        principal: float,
        annual_rate_pct: float,
        duration_months: int,
        insurance_rate_pct: float,
        start_date_str: str,
        now: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        """
        Generates full month-by-month amortization schedule from period 1 to n.
        """
        if duration_months <= 0 or principal <= 0:
            return []

        payment_info = LoanService.calculate_monthly_payment(
            principal, annual_rate_pct, duration_months, insurance_rate_pct
        )
        monthly_pi = payment_info["monthly_principal_interest"]
        monthly_ins = payment_info["monthly_insurance"]
        r = (annual_rate_pct / 100.0) / 12.0

        start_y, start_m = LoanService._parse_start_date(start_date_str)
        elapsed = LoanService.calculate_elapsed_months(start_date_str, now)

        schedule: List[Dict[str, Any]] = []
        balance = principal
        cumulative_principal = 0.0
        cumulative_interest = 0.0

        for period in range(1, duration_months + 1):
            m_offset = (start_y * 12 + start_m - 1) + (period - 1)
            period_year = m_offset // 12
            period_month = (m_offset % 12) + 1
            period_date = f"{period_year:04d}-{period_month:02d}"

            beg_balance = balance
            interest_payment = beg_balance * r
            principal_payment = monthly_pi - interest_payment

            if period == duration_months or principal_payment > balance:
                principal_payment = balance
                ending_balance = 0.0
            else:
                ending_balance = max(0.0, balance - principal_payment)

            balance = ending_balance
            cumulative_principal += principal_payment
            cumulative_interest += interest_payment

            schedule.append({
                "period": period,
                "date": period_date,
                "beginning_balance": round(beg_balance, 2),
                "principal_payment": round(principal_payment, 2),
                "interest_payment": round(interest_payment, 2),
                "insurance_payment": round(monthly_ins, 2),
                "total_payment": round(principal_payment + interest_payment + monthly_ins, 2),
                "ending_balance": round(ending_balance, 2),
                "cumulative_principal": round(cumulative_principal, 2),
                "cumulative_interest": round(cumulative_interest, 2),
                "is_past": period <= elapsed,
            })

            if balance <= 0:
                break

        return schedule

    @staticmethod
    def simulate_early_repayment(
        principal: float,
        annual_rate_pct: float,
        duration_months: int,
        insurance_rate_pct: float,
        start_date_str: str,
        repayment_amount: float,
        repayment_month_index: Optional[int] = None,
        strategy: str = "reduce_duration",  # "reduce_duration" or "reduce_payment"
        penalty_rate_pct: float = 0.0,  # IRA % (capped legally in France)
        now: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """
        Simulates the financial impact of a partial early repayment:
        - Strategy 'reduce_duration': keeps same monthly payment, shortens term.
        - Strategy 'reduce_payment': keeps original end date, reduces monthly payment.
        Calculates exact interest savings, insurance savings, and net savings.
        """
        if repayment_amount <= 0:
            raise ValueError("Repayment amount must be positive.")

        elapsed = LoanService.calculate_elapsed_months(start_date_str, now)
        k = repayment_month_index if repayment_month_index is not None else elapsed
        k = min(duration_months - 1, max(1, k))

        # Base status up to month k
        base_status = LoanService.calculate_live_status(
            principal, annual_rate_pct, duration_months, insurance_rate_pct, start_date_str, now
        )
        r = (annual_rate_pct / 100.0) / 12.0
        monthly_pi = base_status["monthly_principal_interest"]
        monthly_ins = base_status["monthly_insurance"]

        # Find balance at month k
        bal = principal
        for _ in range(k):
            interest = bal * r
            pr = monthly_pi - interest
            bal = max(0.0, bal - pr)

        current_balance_at_k = bal
        effective_repayment = min(repayment_amount, current_balance_at_k)

        # Early repayment indemnity (IRA in France: max 6 months interest or 3% of remaining)
        six_months_interest = effective_repayment * r * 6.0
        three_percent_cap = effective_repayment * 0.03
        legal_max_penalty = min(six_months_interest, three_percent_cap)
        requested_penalty = effective_repayment * (penalty_rate_pct / 100.0)
        penalty_amount = round(min(requested_penalty, legal_max_penalty), 2)

        new_balance = max(0.0, current_balance_at_k - effective_repayment)
        original_remaining_months = duration_months - k

        # Baseline: interest and insurance that would have been paid from month k without early repayment
        remaining_interest_baseline = 0.0
        cur_bal = current_balance_at_k
        for _ in range(original_remaining_months):
            ci = cur_bal * r
            cp = monthly_pi - ci
            cur_bal = max(0.0, cur_bal - cp)
            remaining_interest_baseline += ci

        remaining_insurance_baseline = original_remaining_months * monthly_ins

        if strategy == "reduce_duration":
            # Keep monthly_pi the same, calculate new remaining months
            if new_balance <= 0:
                new_remaining_months = 0
                new_total_interest = 0.0
                new_monthly_payment = 0.0
            elif r > 0:
                # n = -log(1 - (new_balance * r / monthly_pi)) / log(1 + r)
                ratio = (new_balance * r) / monthly_pi
                if ratio < 1.0:
                    exact_n = -math.log(1.0 - ratio) / math.log(1.0 + r)
                    new_remaining_months = math.ceil(exact_n)
                else:
                    new_remaining_months = original_remaining_months

                # Simulate remaining months with new_balance
                sim_bal = new_balance
                sim_int = 0.0
                for _ in range(new_remaining_months):
                    ci = sim_bal * r
                    cp = monthly_pi - ci
                    if cp > sim_bal:
                        cp = sim_bal
                    sim_bal = max(0.0, sim_bal - cp)
                    sim_int += ci
                new_total_interest = sim_int
                new_monthly_payment = base_status["monthly_payment"]
            else:
                new_remaining_months = math.ceil(new_balance / monthly_pi) if monthly_pi > 0 else 0
                new_total_interest = 0.0
                new_monthly_payment = base_status["monthly_payment"]

            months_saved = max(0, original_remaining_months - new_remaining_months)
            years_saved = round(months_saved / 12.0, 1)
            new_insurance = new_remaining_months * monthly_ins
            interest_saved = max(0.0, remaining_interest_baseline - new_total_interest)
            insurance_saved = max(0.0, remaining_insurance_baseline - new_insurance)
            net_savings = max(0.0, interest_saved + insurance_saved - penalty_amount)

            return {
                "strategy": "reduce_duration",
                "repayment_amount": effective_repayment,
                "repayment_month": k,
                "penalty_amount": penalty_amount,
                "balance_before": round(current_balance_at_k, 2),
                "balance_after": round(new_balance, 2),
                "original_remaining_months": original_remaining_months,
                "new_remaining_months": new_remaining_months,
                "months_saved": months_saved,
                "years_saved": years_saved,
                "current_monthly_payment": base_status["monthly_payment"],
                "new_monthly_payment": round(new_monthly_payment, 2),
                "monthly_payment_change": 0.0,
                "interest_saved": round(interest_saved, 2),
                "insurance_saved": round(insurance_saved, 2),
                "total_gross_savings": round(interest_saved + insurance_saved, 2),
                "net_savings": round(net_savings, 2),
            }

        else:  # "reduce_payment"
            # Keep original_remaining_months, recalculate lower monthly_pi
            if new_balance <= 0:
                new_monthly_pi = 0.0
                new_monthly_payment = 0.0
                new_total_interest = 0.0
                new_insurance = 0.0
            elif r > 0 and original_remaining_months > 0:
                factor = (1.0 + r) ** original_remaining_months
                new_monthly_pi = new_balance * (r * factor) / (factor - 1.0)
                new_total_interest = max(0.0, (new_monthly_pi * original_remaining_months) - new_balance)
                new_monthly_payment = new_monthly_pi + monthly_ins
                new_insurance = original_remaining_months * monthly_ins
            else:
                new_monthly_pi = new_balance / max(1, original_remaining_months)
                new_total_interest = 0.0
                new_monthly_payment = new_monthly_pi + monthly_ins
                new_insurance = original_remaining_months * monthly_ins

            monthly_drop = max(0.0, base_status["monthly_payment"] - new_monthly_payment)
            interest_saved = max(0.0, remaining_interest_baseline - new_total_interest)
            insurance_saved = 0.0  # standard insurance remains tied to initial capital or months unless renegotiated
            net_savings = max(0.0, interest_saved + insurance_saved - penalty_amount)

            return {
                "strategy": "reduce_payment",
                "repayment_amount": effective_repayment,
                "repayment_month": k,
                "penalty_amount": penalty_amount,
                "balance_before": round(current_balance_at_k, 2),
                "balance_after": round(new_balance, 2),
                "original_remaining_months": original_remaining_months,
                "new_remaining_months": original_remaining_months,
                "months_saved": 0,
                "years_saved": 0.0,
                "current_monthly_payment": base_status["monthly_payment"],
                "new_monthly_payment": round(new_monthly_payment, 2),
                "monthly_payment_change": round(-monthly_drop, 2),
                "interest_saved": round(interest_saved, 2),
                "insurance_saved": round(insurance_saved, 2),
                "total_gross_savings": round(interest_saved + insurance_saved, 2),
                "net_savings": round(net_savings, 2),
            }
