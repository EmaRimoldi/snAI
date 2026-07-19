import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { DocumentRecord, DocumentType, ExtractedField } from "@/lib/pipeline/types";
import { classifyDocument, extractFields } from "@/lib/engine/extract";
import {
  computeGrossAnnualCents,
  computeReadiness,
  compareToThreshold,
  thresholdCentsForSize,
  centsToDollars,
} from "@/lib/pipeline/calc";
// Mirrors REQUIRED_CHECKLIST in lib/pipeline/state.tsx (client-only module).
const REQUIRED_CHECKLIST: readonly DocumentType[] = [
  "application_summary",
  "pay_stub",
  "employment_letter",
];

// Dev-only diagnostic: runs the REAL frontend pipeline (engine adapter + calc)
// over every official household's documents and reports the computed numbers.
// It reads only the synthetic documents (never gold/eval files) and returns
// computed values — expectations live outside the product, in the test caller.

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Not available" }, { status: 404 });
  }

  const dir = path.resolve(
    process.cwd(),
    "../engine/tests/fixtures/synthetic_documents/documents",
  );
  const allNames = (await readdir(dir)).sort();
  const households = ["hh-001", "hh-002", "hh-003", "hh-004", "hh-005", "hh-006"];

  const results = [];
  for (const hh of households) {
    const names = allNames.filter((n) => n.startsWith(`${hh}_`));
    const documents: DocumentRecord[] = [];
    const fields: ExtractedField[] = [];

    for (const name of names) {
      const bytes = await readFile(path.join(dir, name));
      const file = new File([new Uint8Array(bytes)], name, { type: "application/pdf" });
      const id = `${hh}-${name}`;
      const { documentType, confidence } = await classifyDocument(file);
      const extracted = await extractFields({ id, fileName: name, documentType });
      documents.push({
        id,
        fileName: name,
        fileUrl: "",
        mimeType: "application/pdf",
        documentType,
        classifyConfidence: confidence,
        pageCount: 1,
        quarantinedText: extracted.quarantinedText,
      });
      // Simulate the renter confirming every extracted value.
      fields.push(...extracted.fields.map((f) => ({ ...f, reviewStatus: "confirmed" as const })));
    }

    const sizeField = fields.find((f) => f.key === "household_size");
    const householdSize = sizeField ? parseInt(sizeField.value, 10) : 1;
    const present = new Set<DocumentType>(documents.map((d) => d.documentType));
    const missingRequired = REQUIRED_CHECKLIST.filter((t) => !present.has(t));

    const incomeCents = computeGrossAnnualCents(documents, fields);
    const readiness = computeReadiness(documents, fields, missingRequired);
    const comparison = compareToThreshold(incomeCents, thresholdCentsForSize(householdSize));

    results.push({
      household: hh.toUpperCase(),
      documents: names.length,
      householdSize,
      annualizedIncome: centsToDollars(incomeCents),
      readiness: readiness.status,
      blockingCodes: readiness.reasons
        .filter((r) => r.blocking && r.code !== "UNCONFIRMED_FIELDS")
        .map((r) => r.code)
        .sort(),
      missingInformational: missingRequired,
      comparison,
    });
  }

  return Response.json({ results }, { headers: { "Cache-Control": "no-store" } });
}
