"""Deterministic challenge calculations; not an eligibility engine."""

FREQUENCY = {"weekly": 52, "biweekly": 26, "semimonthly": 24, "monthly": 12, "annual": 1}

def annualize(amount: float, frequency: str) -> float:
    if frequency not in FREQUENCY:
        raise ValueError(f"Unsupported frequency: {frequency}")
    if amount < 0:
        raise ValueError("Amount must be non-negative")
    return round(float(amount) * FREQUENCY[frequency], 2)

def compare_to_threshold(annual_income: float, threshold: float) -> str:
    if annual_income < 0 or threshold < 0:
        raise ValueError("Values must be non-negative")
    return "below_or_equal" if annual_income <= threshold else "above"
