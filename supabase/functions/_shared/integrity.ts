export const FROZEN_60_THRESHOLDS: Readonly<Record<number, number>> = Object.freeze({
  1: 72_000,
  2: 82_320,
  3: 92_580,
  4: 102_840,
  5: 111_120,
  6: 119_340,
  7: 127_560,
  8: 135_780,
});

const FREQUENCY_MULTIPLIER: Readonly<Record<string, number>> = Object.freeze({
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
  annual: 1,
});

type IntegrityIncomeSource = {
  periodAmount: number;
  frequency: string;
  annualAmount: number;
};

export type ArithmeticContext = {
  householdSize: number | null;
  annualizedIncome: number | null;
  frozenThreshold: number | null;
  comparison: "below_or_equal" | "above" | "no_frozen_threshold" | null;
  incomeSources: readonly IntegrityIncomeSource[];
};

export type ContextIntegrityCode =
  | "INCOME_SOURCE_ARITHMETIC"
  | "ANNUALIZED_INCOME_TOTAL"
  | "MISSING_CONFIRMED_INCOME_SOURCE"
  | "HOUSEHOLD_THRESHOLD_MISMATCH"
  | "COMPARISON_MISMATCH";

function cents(value: number): number {
  return Math.round(value * 100);
}

/**
 * Recomputes every arithmetic value independently of the browser. The client
 * may display these values, but it is never their authority boundary.
 */
export function contextIntegrityError(context: ArithmeticContext): ContextIntegrityCode | null {
  for (const source of context.incomeSources) {
    const multiplier = FREQUENCY_MULTIPLIER[source.frequency];
    if (!multiplier || cents(source.periodAmount) * multiplier !== cents(source.annualAmount)) {
      return "INCOME_SOURCE_ARITHMETIC";
    }
  }

  if (context.incomeSources.length === 0) {
    if (context.annualizedIncome !== null) return "MISSING_CONFIRMED_INCOME_SOURCE";
  } else {
    if (context.annualizedIncome === null) return "ANNUALIZED_INCOME_TOTAL";
    const expectedAnnualCents = context.incomeSources
      .reduce((total, source) => total + cents(source.annualAmount), 0);
    if (expectedAnnualCents !== cents(context.annualizedIncome)) {
      return "ANNUALIZED_INCOME_TOTAL";
    }
  }

  const expectedThreshold = context.householdSize === null
    ? null
    : FROZEN_60_THRESHOLDS[context.householdSize] ?? null;
  if (
    (expectedThreshold === null && context.frozenThreshold !== null) ||
    (expectedThreshold !== null && cents(context.frozenThreshold ?? -1) !== cents(expectedThreshold))
  ) {
    return "HOUSEHOLD_THRESHOLD_MISMATCH";
  }

  const expectedComparison = context.annualizedIncome === null || context.householdSize === null
    ? null
    : expectedThreshold === null
      ? "no_frozen_threshold"
      : context.annualizedIncome <= expectedThreshold
        ? "below_or_equal"
        : "above";
  return context.comparison === expectedComparison ? null : "COMPARISON_MISMATCH";
}
