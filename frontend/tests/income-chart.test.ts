import { describe, expect, it } from "vitest";
import { buildIncomeChartParts } from "@/components/pipeline/IncomeContributionChart";
import type { DocumentRecord, ExtractedField } from "@/lib/pipeline/types";

const document = (id: string): DocumentRecord => ({
  id,
  fileName: `${id}.pdf`,
  fileUrl: "blob:test",
  mimeType: "application/pdf",
  documentType: "pay_stub",
  classifyConfidence: 1,
  pageCount: 1,
});

const field = (
  documentId: string,
  key: string,
  value: string,
  options: Partial<ExtractedField> = {},
): ExtractedField => ({
  id: `${documentId}:${key}`,
  documentId,
  key,
  value,
  page: 1,
  bbox: [0.1, 0.1, 0.2, 0.2],
  confidence: 1,
  reviewStatus: "confirmed",
  ...options,
});

describe("income chart", () => {
  it("updates the open pay stub even when that stub only corroborates the counted one", () => {
    const documents = [document("older"), document("latest")];
    const baseFields: ExtractedField[] = [
      field("older", "pay_date", "2026-06-20"),
      field("older", "gross_pay", "2000", { isIncome: true, incomeFrequency: "biweekly" }),
      field("older", "net_pay", "1500"),
      field("latest", "pay_date", "2026-06-27"),
      field("latest", "gross_pay", "2200", { isIncome: true, incomeFrequency: "biweekly" }),
      field("latest", "net_pay", "1700"),
    ];

    const before = buildIncomeChartParts({
      documents,
      fields: baseFields,
      activeDocumentId: "older",
      netPayLabel: "Net",
      deductionsLabel: "Deductions",
    });
    const after = buildIncomeChartParts({
      documents,
      fields: baseFields.map((item) =>
        item.id === "older:net_pay" ? { ...item, value: "1800", reviewStatus: "edited" } : item,
      ),
      activeDocumentId: "older",
      netPayLabel: "Net",
      deductionsLabel: "Deductions",
    });

    expect(before.map((part) => part.annualCents)).toEqual([3_900_000, 1_300_000]);
    expect(after.map((part) => part.annualCents)).toEqual([4_680_000, 520_000]);
  });

  it("changes the displayed annual value when edited net pay exceeds printed gross", () => {
    const documents = [document("stub")];
    const parts = buildIncomeChartParts({
      documents,
      fields: [
        field("stub", "pay_date", "2026-06-27"),
        field("stub", "gross_pay", "2166", {
          isIncome: true,
          incomeFrequency: "biweekly",
        }),
        field("stub", "net_pay", "6728.48", { reviewStatus: "corrected" }),
      ],
      activeDocumentId: "stub",
      netPayLabel: "Net",
      deductionsLabel: "Deductions",
    });

    expect(parts.map((part) => part.annualCents)).toEqual([17_494_048]);
  });
});
