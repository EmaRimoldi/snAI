"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { annualizeCents, deriveIncomeSources, formatMoneyCents, toCents } from "@/lib/pipeline/calc";
import { useCopy, fmt } from "@/lib/pipeline/copy";
import { useApp } from "@/lib/pipeline/state";
import type { DocumentRecord, DocumentType, ExtractedField } from "@/lib/pipeline/types";
import s from "./pipeline.module.css";

const COLORS = ["#a84f38", "#d4785d", "#e8a27f", "#7e3728", "#c48b66"];

export type IncomeChartPart = {
  key: string;
  label: string;
  annualCents: number;
  type?: DocumentType;
  kind: "source" | "net" | "deductions";
};

export function buildIncomeChartParts(args: {
  documents: readonly DocumentRecord[];
  fields: readonly ExtractedField[];
  activeDocumentId?: string;
  netPayLabel: string;
  deductionsLabel: string;
}): IncomeChartPart[] {
  const { documents, fields, activeDocumentId, netPayLabel, deductionsLabel } = args;
  // The chart previews a just-edited value immediately, while the core income
  // calculation still waits for the renter's explicit confirmation.
  const chartFields = fields.map((field) =>
    field.reviewStatus === "edited"
      ? { ...field, reviewStatus: "corrected" as const }
      : field,
  );
  const derived = deriveIncomeSources(documents, chartFields);
  const activePaySources = activeDocumentId
    ? derived.filter(
        (source) =>
          source.documentId === activeDocumentId && source.documentType === "pay_stub",
      )
    : [];
  // While a pay stub is open, visualize that exact document — including a
  // corroborating/non-counted stub. Otherwise show the counted file-level mix.
  const visibleSources = activePaySources.length > 0
    ? activePaySources
    : derived.filter((source) => source.counted);
  const parts: IncomeChartPart[] = [];

  for (const source of visibleSources) {
    if (source.annualCents <= 0) continue;
    if (source.documentType === "pay_stub") {
      const netPay = chartFields.find(
        (field) =>
          field.documentId === source.documentId &&
          field.key === "net_pay" &&
          field.reviewStatus !== "extracted",
      );
      if (netPay) {
        const annualNet = annualizeCents(
          Math.max(0, toCents(netPay.value)),
          source.frequency,
        );
        if (annualNet > 0) {
          parts.push({
            key: `${source.documentId}-net`,
            label: netPayLabel,
            annualCents: annualNet,
            kind: "net",
          });
        }
        const deductions = Math.max(0, source.annualCents - annualNet);
        if (deductions > 0) {
          parts.push({
            key: `${source.documentId}-deductions`,
            label: deductionsLabel,
            annualCents: deductions,
            kind: "deductions",
          });
        }
        continue;
      }
    }
    parts.push({
      key: source.documentId,
      label: "",
      type: source.documentType,
      annualCents: source.annualCents,
      kind: "source",
    });
  }
  return parts;
}

export default function IncomeContributionChart({ activeDocumentId }: { activeDocumentId?: string }) {
  const c = useCopy();
  const { language } = useI18n();
  const { documents, fields } = useApp();

  const sources = useMemo(
    () =>
      buildIncomeChartParts({
        documents,
        fields,
        activeDocumentId,
        netPayLabel: c.netPayChart,
        deductionsLabel: c.deductionsChart,
      }),
    [activeDocumentId, c.deductionsChart, c.netPayChart, documents, fields],
  );

  const total = sources.reduce((sum, source) => sum + source.annualCents, 0);
  const labels: Partial<Record<DocumentType, string>> = {
    pay_stub: c.srcPay,
    employment_letter: c.srcPay,
    benefit_letter: c.srcBenefit,
    gig_statement: c.srcGig,
  };
  const colorFor = (source: IncomeChartPart, index: number) =>
    source.kind === "net"
      ? "#2f7d57"
      : source.kind === "deductions"
        ? "#d4785d"
        : COLORS[index % COLORS.length];
  let cursor = 0;
  const gradient =
    total > 0
      ? `conic-gradient(${sources
          .map((source, index) => {
            const start = cursor;
            cursor += (source.annualCents / total) * 100;
            return `${colorFor(source, index)} ${start}% ${cursor}%`;
          })
          .join(", ")})`
      : "conic-gradient(var(--input) 0 100%)";

  return (
    <section className={s.incomeChart} aria-label={c.incomeComposition}>
      <h4 className={s.incomeChartTitle}>{c.incomeComposition}</h4>
      <div className={s.incomeDonut} style={{ background: gradient }} aria-live="polite">
        <div className={s.incomeDonutCenter}>
          <strong>{formatMoneyCents(total, language)}</strong>
          <span>{c.incomeCompositionTitle}</span>
        </div>
      </div>

      <div className={s.incomeLegend}>
        {sources.length === 0 ? (
          <p>{c.incomeChartEmpty}</p>
        ) : (
          <ul>
            {sources.map((source, index) => {
              const percent = Math.round((source.annualCents / total) * 100);
              return (
                <li key={source.key}>
                  <span
                    className={s.incomeLegendDot}
                    style={{ background: colorFor(source, index) }}
                    aria-hidden="true"
                  />
                  <span>
                    <strong>{source.label || labels[source.type ?? "unknown"] || c.incomeLabel}</strong>
                    <small>
                      {formatMoneyCents(source.annualCents, language)} · {fmt(c.incomeShare, { pct: percent })}
                    </small>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
