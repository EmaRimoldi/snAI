// FY2026 60% MTSP income limits — Boston-Cambridge-Quincy, MA-NH HUD Metro FMR Area.
// Bundled from the organizer starter pack (rule HUD-MTSP-002). This is the frozen,
// scored threshold table; the 50% table exists for context but 60% is authoritative.
// Values are whole dollars; the app compares in integer cents.

export const MTSP_2026 = {
  fiscalYear: 2026,
  hudArea: "Boston-Cambridge-Quincy, MA-NH HUD Metro FMR Area",
  medianFamilyIncome: 164_600,
  effectiveDate: "2026-05-01",
  ruleId: "HUD-MTSP-002",
  sourceUrl:
    "https://www.huduser.gov/portal/datasets/mtsp/mtsp26/HERA-Income-Limits-Report-FY26.pdf",
  sourceLocator: "HERA Income Limits Report FY26, PDF page 130",
  // household size (1-8) -> 60% income limit in whole dollars
  thresholds60: {
    1: 72_000,
    2: 82_320,
    3: 92_580,
    4: 102_840,
    5: 111_120,
    6: 119_340,
    7: 127_560,
    8: 135_780,
  } as const,
} as const;

export type HouseholdSize = keyof typeof MTSP_2026.thresholds60;

/** 60% threshold in whole dollars for a household size, or null if out of the 1-8 table. */
export function thresholdForSize(size: number): number | null {
  const key = size as HouseholdSize;
  return MTSP_2026.thresholds60[key] ?? null;
}
