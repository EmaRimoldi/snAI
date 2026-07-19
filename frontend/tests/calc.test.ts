// Unit tests for the deterministic pipeline math (lib/pipeline/calc.ts).
// Values are synthetic and never keyed to oracle household IDs — the rules are
// tested, not the fixtures (hidden tests may perturb names and values).
import { describe, expect, it } from "vitest";
import {
  annualizeCents,
  compareToThreshold,
  computeGrossAnnualCents,
  computeReadiness,
  countUnresolved,
  deriveDisplayStatus,
  deriveIncomeSources,
  thresholdCentsForSize,
  toCents,
} from "@/lib/pipeline/calc";
import type {
  DocumentRecord,
  DocumentType,
  ExtractedField,
  FieldReviewStatus,
} from "@/lib/pipeline/types";

let nextId = 0;
function doc(documentType: DocumentType): DocumentRecord {
  nextId += 1;
  return {
    id: `doc-${nextId}`,
    fileName: `${documentType}-${nextId}.pdf`,
    fileUrl: "",
    mimeType: "application/pdf",
    documentType,
    classifyConfidence: 0.95,
    pageCount: 1,
  };
}

function field(
  d: DocumentRecord,
  key: string,
  value: string,
  extra: Partial<ExtractedField> = {},
  reviewStatus: FieldReviewStatus = "confirmed",
): ExtractedField {
  nextId += 1;
  return {
    id: `f-${nextId}`,
    documentId: d.id,
    key,
    value,
    page: 1,
    bbox: [0.1, 0.1, 0.4, 0.15],
    confidence: 0.95,
    reviewStatus,
    ...extra,
  };
}

const stubFields = (
  d: DocumentRecord,
  { gross, rate, hours, freq, payDate }: {
    gross: string; rate?: string; hours?: string; freq: "weekly" | "biweekly"; payDate: string;
  },
) => {
  const fields = [
    field(d, "gross_pay", gross, { isIncome: true, incomeFrequency: freq }),
    field(d, "pay_frequency", freq),
    field(d, "pay_date", payDate),
  ];
  if (rate) fields.push(field(d, "hourly_rate", rate));
  if (hours) fields.push(field(d, "regular_hours", hours));
  return fields;
};

describe("annualizeCents", () => {
  it("applies the frozen multipliers", () => {
    expect(annualizeCents(100000, "weekly")).toBe(5200000);
    expect(annualizeCents(200000, "biweekly")).toBe(5200000);
    expect(annualizeCents(100000, "semimonthly")).toBe(2400000);
    expect(annualizeCents(100000, "monthly")).toBe(1200000);
    expect(annualizeCents(100000, "annual")).toBe(100000);
  });
  it("rejects negative amounts", () => {
    expect(() => annualizeCents(-1, "weekly")).toThrow();
  });
});

describe("compareToThreshold", () => {
  it("treats equality as below_or_equal (inclusive boundary)", () => {
    expect(compareToThreshold(7200000, 7200000)).toBe("below_or_equal");
    expect(compareToThreshold(7200001, 7200000)).toBe("above");
  });
  it("has no comparison without a frozen threshold", () => {
    expect(compareToThreshold(1, null)).toBe("no_frozen_threshold");
  });
});

describe("review confirmation", () => {
  it("keeps an edited value unresolved until Confirm is clicked", () => {
    const application = doc("application_summary");
    expect(countUnresolved([field(application, "person_name", "Edited name", {}, "edited")])).toBe(1);
    expect(countUnresolved([field(application, "person_name", "Edited name", {}, "confirmed")])).toBe(0);
  });
});

describe("thresholdCentsForSize", () => {
  it("is null for missing or out-of-table sizes", () => {
    expect(thresholdCentsForSize(null)).toBeNull();
    expect(thresholdCentsForSize(9)).toBeNull();
    expect(thresholdCentsForSize(0)).toBeNull();
  });
  it("returns cents for in-table sizes", () => {
    expect(thresholdCentsForSize(1)).toBeGreaterThan(0);
  });
});

describe("deriveIncomeSources — corroboration and bases", () => {
  it("counts one wage source when several stubs corroborate (latest pay_date wins)", () => {
    const s1 = doc("pay_stub");
    const s2 = doc("pay_stub");
    const fields = [
      ...stubFields(s1, { gross: "2000.00", rate: "25.00", hours: "80", freq: "biweekly", payDate: "2026-06-10" }),
      ...stubFields(s2, { gross: "2000.00", rate: "25.00", hours: "80", freq: "biweekly", payDate: "2026-06-24" }),
    ];
    const counted = deriveIncomeSources([s1, s2], fields).filter((s) => s.counted);
    expect(counted).toHaveLength(1);
    expect(counted[0].documentId).toBe(s2.id);
    expect(computeGrossAnnualCents([s1, s2], fields)).toBe(200000 * 26);
  });

  it("uses hours × rate over a conflicting printed gross", () => {
    const s = doc("pay_stub");
    const fields = stubFields(s, {
      gross: "1500.00", rate: "20.00", hours: "40", freq: "weekly", payDate: "2026-06-20",
    });
    const [wage] = deriveIncomeSources([s], fields).filter((x) => x.counted);
    expect(wage.periodCents).toBe(80000); // 20.00 × 40, not the printed 1500.00
    expect(wage.annualCents).toBe(80000 * 52);
  });

  it("falls back to the printed gross when hours/rate are absent", () => {
    const s = doc("pay_stub");
    const fields = stubFields(s, { gross: "1234.56", freq: "weekly", payDate: "2026-06-20" });
    const [wage] = deriveIncomeSources([s], fields).filter((x) => x.counted);
    expect(wage.periodCents).toBe(123456);
  });

  it("derives a weekly wage from an employment letter when no stub exists", () => {
    const l = doc("employment_letter");
    const fields = [
      field(l, "weekly_hours", "30"),
      field(l, "hourly_rate", "40.00"),
      field(l, "document_date", "2026-07-01"),
    ];
    const counted = deriveIncomeSources([l], fields).filter((x) => x.counted);
    expect(counted).toHaveLength(1);
    expect(counted[0].annualCents).toBe(120000 * 52);
  });

  it("never adds the letter on top of a stub", () => {
    const s = doc("pay_stub");
    const l = doc("employment_letter");
    const fields = [
      ...stubFields(s, { gross: "800.00", rate: "20.00", hours: "40", freq: "weekly", payDate: "2026-06-20" }),
      field(l, "weekly_hours", "40"),
      field(l, "hourly_rate", "20.00"),
    ];
    expect(computeGrossAnnualCents([s, l], fields)).toBe(80000 * 52);
  });

  it("counts benefit amounts named by any frequency", () => {
    const b = doc("benefit_letter");
    const fields = [
      field(b, "annual_benefit", "55000.00", { isIncome: true, incomeFrequency: "annual" }),
    ];
    expect(computeGrossAnnualCents([b], fields)).toBe(5500000);
  });

  it("skips negative amounts instead of throwing", () => {
    const b = doc("benefit_letter");
    const fields = [
      field(b, "monthly_benefit", "-850.00", { isIncome: true, incomeFrequency: "monthly" }),
    ];
    expect(() => deriveIncomeSources([b], fields)).not.toThrow();
    expect(computeGrossAnnualCents([b], fields)).toBe(0);
  });

  it("ignores unconfirmed values entirely", () => {
    const s = doc("pay_stub");
    const fields = [
      field(s, "gross_pay", "1000.00", { isIncome: true, incomeFrequency: "weekly" }, "extracted"),
    ];
    expect(computeGrossAnnualCents([s], fields)).toBe(0);
  });
});

describe("computeReadiness — reason codes", () => {
  const size3 = (d: DocumentRecord) => field(d, "household_size", "3");

  it("flags expiry per document type, including YYYY-MM statement months", () => {
    const app = doc("application_summary");
    const letter = doc("employment_letter");
    const gig = doc("gig_statement");
    const fields = [
      size3(app),
      field(letter, "document_date", "2026-04-30"),
      field(gig, "gross_receipts", "1000.00", { isIncome: true, incomeFrequency: "monthly" }),
      field(gig, "statement_month", "2026-03"), // March: last covered day < cutoff
    ];
    const codes = computeReadiness([app, letter, gig], fields, [], 3).reasons.map((r) => r.code);
    expect(codes).toContain("EMPLOYMENT_LETTER_EXPIRED");
    expect(codes).toContain("GIG_STATEMENT_EXPIRED");
    expect(codes).toContain("GIG_INCOME_UNCORROBORATED");
  });

  it("keeps a current YYYY-MM statement month unexpired (last covered day)", () => {
    const gig = doc("gig_statement");
    const app = doc("application_summary");
    const fields = [
      size3(app),
      field(gig, "gross_receipts", "1000.00", { isIncome: true, incomeFrequency: "monthly" }),
      field(gig, "statement_month", "2026-05"), // May 31 >= May 19 cutoff
    ];
    const codes = computeReadiness([app, gig], fields, [], 3).reasons.map((r) => r.code);
    expect(codes).not.toContain("GIG_STATEMENT_EXPIRED");
  });

  it("flags a letter rate that conflicts with every stub rate", () => {
    const s = doc("pay_stub");
    const l = doc("employment_letter");
    const app = doc("application_summary");
    const fields = [
      size3(app),
      ...stubFields(s, { gross: "800.00", rate: "20.00", hours: "40", freq: "weekly", payDate: "2026-06-20" }),
      field(l, "hourly_rate", "22.00"),
      field(l, "document_date", "2026-07-01"),
    ];
    const codes = computeReadiness([app, s, l], fields, [], 3).reasons.map((r) => r.code);
    expect(codes).toContain("EMPLOYMENT_RATE_CONFLICT");
  });

  it("reports MISSING_HOUSEHOLD_SIZE / NO_FROZEN_THRESHOLD / MISSING_INCOME_EVIDENCE once nothing is pending", () => {
    const app = doc("application_summary");
    const noSize = computeReadiness([app], [field(app, "person_name", "A B")], [], null);
    expect(noSize.reasons.map((r) => r.code)).toContain("MISSING_HOUSEHOLD_SIZE");
    expect(noSize.reasons.map((r) => r.code)).toContain("MISSING_INCOME_EVIDENCE");

    const size9 = computeReadiness([app], [field(app, "household_size", "9")], [], 9);
    expect(size9.reasons.map((r) => r.code)).toContain("NO_FROZEN_THRESHOLD");
  });

  it("does NOT call values missing while confirmations are pending", () => {
    const app = doc("application_summary");
    const pending = computeReadiness(
      [app],
      [field(app, "person_name", "A B", {}, "extracted")],
      [],
      null,
    );
    const codes = pending.reasons.map((r) => r.code);
    expect(codes).not.toContain("MISSING_HOUSEHOLD_SIZE");
    expect(codes).not.toContain("MISSING_INCOME_EVIDENCE");
    expect(codes).toContain("UNCONFIRMED_FIELDS");
  });

  it("flags self-declared income and never counts it", () => {
    const app = doc("application_summary");
    const fields = [size3(app), field(app, "declared_income", "30000")];
    const result = computeReadiness([app], fields, [], 3);
    expect(result.reasons.map((r) => r.code)).toContain("UNVERIFIED_INCOME_CLAIM");
    expect(computeGrossAnnualCents([app], fields)).toBe(0);
  });

  it("missing documents never block; evidence issues do", () => {
    const app = doc("application_summary");
    const fields = [
      size3(app),
      field(app, "declared_income", "1"), // gives one blocking evidence reason
    ];
    const result = computeReadiness([app], fields, ["employment_letter"], 3);
    const missing = result.reasons.find((r) => r.code === "MISSING_REQUIRED_DOCUMENT");
    expect(missing?.blocking).toBe(false);
  });
});

describe("deriveDisplayStatus ladder", () => {
  const base = { documentCount: 1, busy: false, locked: false, unresolvedCount: 0, missingRequiredCount: 0 };
  it("walks the ladder", () => {
    expect(deriveDisplayStatus({ ...base, documentCount: 0, reasons: [] })).toBe("NOT_STARTED");
    expect(deriveDisplayStatus({ ...base, busy: true, reasons: [] })).toBe("PROCESSING");
    expect(
      deriveDisplayStatus({ ...base, reasons: [{ code: "PAY_STUB_TOTAL_CONFLICT", blocking: true }] }),
    ).toBe("EVIDENCE_ISSUES");
    expect(deriveDisplayStatus({ ...base, unresolvedCount: 2, reasons: [] })).toBe("AWAITING_CONFIRMATION");
    expect(deriveDisplayStatus({ ...base, missingRequiredCount: 1, reasons: [] })).toBe("DOCUMENTS_MISSING");
    expect(deriveDisplayStatus({ ...base, reasons: [] })).toBe("READY");
  });
});

describe("toCents", () => {
  it("parses currency-ish strings", () => {
    expect(toCents("$2,166.00")).toBe(216600);
    expect(toCents("960")).toBe(96000);
    expect(toCents("garbage")).toBe(0);
  });
});
