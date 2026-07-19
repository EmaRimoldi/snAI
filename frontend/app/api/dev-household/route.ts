import { readFile } from "node:fs/promises";
import path from "node:path";

const HOUSEHOLD_FILES = [
  "hh-001_d01_application_summary.pdf",
  "hh-001_d02_pay_stub.pdf",
  "hh-001_d03_pay_stub.pdf",
  "hh-001_d04_employment_letter.pdf",
] as const;

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Development fixture not available" }, { status: 404 });
  }

  const fixtureDirectory = path.resolve(
    process.cwd(),
    "../engine/tests/fixtures/synthetic_documents/documents",
  );
  const files = await Promise.all(
    HOUSEHOLD_FILES.map(async (name) => ({
      name,
      type: "application/pdf",
      contentBase64: (await readFile(path.join(fixtureDirectory, name))).toString("base64"),
    })),
  );

  return Response.json(
    { householdId: "HH-001", files },
    { headers: { "Cache-Control": "no-store" } },
  );
}
