import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

// Dev-only fixture feed: serves the COMPLETE document set of one official
// household (all of its PDFs, discovered from the fixtures directory).
// Household selected via NEXT_PUBLIC_DEMO_HOUSEHOLD (e.g. HH-001 … HH-006).

export const dynamic = "force-dynamic";

const HOUSEHOLD_PATTERN = /^HH-00[1-6]$/;

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Development fixture not available" }, { status: 404 });
  }

  const householdId = process.env.NEXT_PUBLIC_DEMO_HOUSEHOLD ?? "HH-001";
  if (!HOUSEHOLD_PATTERN.test(householdId)) {
    return Response.json({ error: `Unknown household "${householdId}"` }, { status: 400 });
  }

  const fixtureDirectory = path.resolve(
    process.cwd(),
    "../engine/tests/fixtures/synthetic_documents/documents",
  );
  const prefix = `${householdId.toLowerCase()}_`;
  const names = (await readdir(fixtureDirectory)).filter((n) => n.startsWith(prefix)).sort();
  if (names.length === 0) {
    return Response.json({ error: `No fixtures for ${householdId}` }, { status: 404 });
  }

  const files = await Promise.all(
    names.map(async (name) => ({
      name,
      type: "application/pdf",
      contentBase64: (await readFile(path.join(fixtureDirectory, name))).toString("base64"),
    })),
  );

  return Response.json(
    { householdId, files },
    { headers: { "Cache-Control": "no-store" } },
  );
}
