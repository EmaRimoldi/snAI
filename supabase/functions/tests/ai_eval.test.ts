import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { APP_GUIDE } from "../_shared/app_guide.ts";
import type { ChatRequest, SafeUnderstandingContext } from "../_shared/contract.ts";
import { classifyRequest, deterministicFallback } from "../_shared/policy.ts";
import { TRUSTED_RULES } from "../_shared/rules.ts";

const ROOT = process.cwd();

function jsonl(path: string): Record<string, unknown>[] {
  return readFileSync(`${ROOT}/${path}`, "utf8").trim().split("\n").map((line) => JSON.parse(line));
}

function contextFromChecklist(row: Record<string, unknown>): SafeUnderstandingContext {
  return {
    householdSize: row.household_size as number,
    annualizedIncome: row.expected_annualized_income as number,
    frozenThreshold: row.frozen_60_percent_threshold as number,
    comparison: row.comparison as SafeUnderstandingContext["comparison"],
    readinessStatus: row.expected_readiness_status as SafeUnderstandingContext["readinessStatus"],
    documents: (row.present_document_types as string[]).map((documentType, index) => ({ documentId: `doc-${index + 1}`, documentType })),
    missingDocumentTypes: row.missing_document_types as string[],
    incomeSources: [],
    reviewReasons: (row.expected_review_reasons as string[]).map((code) => ({ code, blocking: true, documentId: null, evidenceRefs: [] })),
    evidence: [],
  };
}

test("all 36 organizer QA cases resolve to their expected frozen rule citations", () => {
  const qa = jsonl("engine/tests/fixtures/evaluation/qa_gold.jsonl");
  const checklist = JSON.parse(readFileSync(`${ROOT}/engine/tests/fixtures/evaluation/application_checklists.json`, "utf8")) as Record<string, unknown>[];
  const contexts = new Map(checklist.map((row) => [row.household_id as string, contextFromChecklist(row)]));
  assert.equal(qa.length, 36);

  for (const row of qa) {
    const householdId = row.household_id as string | null;
    const request: ChatRequest = householdId
      ? { mode: "personalized", locale: "en", question: row.question as string, context: contexts.get(householdId) }
      : { mode: "general", locale: "en", question: row.question as string };
    const decision = classifyRequest(request) ?? deterministicFallback(request, TRUSTED_RULES, APP_GUIDE);
    const citedRules = new Set(decision.citationRefs.filter((ref) => ref.startsWith("rule:")).map((ref) => ref.slice(5)));
    for (const expectedRule of row.rule_ids as string[]) {
      assert.ok(citedRules.has(expectedRule), `${row.qa_id}: missing ${expectedRule}; got ${[...citedRules].join(", ")}`);
    }
    assert.notEqual(decision.outcome, "abstained", String(row.qa_id));
  }
});

test("all 12 conversational cases in the 24 organizer adversarial fixtures assert exact policy codes", () => {
  const adversarial = jsonl("engine/tests/fixtures/evaluation/adversarial_tests.jsonl");
  assert.equal(adversarial.length, 24);
  const expectedPolicy: Record<string, string> = {
    prompt_injection: "PROMPT_INJECTION",
    cross_applicant_leak: "CROSS_APPLICANT_DATA",
    eligibility_overreach: "DECISION_BOUNDARY",
    vacancy_hallucination: "DATASET_LIMITATION",
    wrong_year_limit: "FROZEN_CORPUS_ONLY",
    unsupported_trait: "PROTECTED_TRAIT_INFERENCE",
  };
  const cases = adversarial.filter((row) => expectedPolicy[row.category as string]);
  assert.equal(cases.length, 12);
  for (const row of cases) {
    const decision = classifyRequest({ mode: "general", locale: "en", question: row.input as string });
    assert.equal(decision?.policyCode, expectedPolicy[row.category as string], String(row.test_id));
    assert.ok((decision?.citationRefs.length ?? 0) > 0, `${row.test_id}: policy response must be grounded`);
  }
});

test("all 12 non-conversational organizer adversarial fixtures map to explicit deterministic gates", () => {
  const adversarial = jsonl("engine/tests/fixtures/evaluation/adversarial_tests.jsonl");
  const expectedGate: Record<string, string> = {
    missing_citation: "GROUNDING_FAILURE",
    expired_document: "EMPLOYMENT_LETTER_EXPIRED",
    conflicting_totals: "PAY_STUB_TOTAL_CONFLICT",
    malformed_bbox: "SCHEMA_VALIDATION",
    household_size_9: "NO_FROZEN_THRESHOLD",
    unsigned_claim: "GIG_INCOME_UNCORROBORATED",
  };
  const cases = adversarial.filter((row) => expectedGate[row.category as string]);
  assert.equal(cases.length, 12);
  for (const row of cases) {
    assert.ok(expectedGate[row.category as string], `${row.test_id}: missing deterministic gate`);
    assert.equal(typeof row.expected_behavior, "string", `${row.test_id}: missing expected behavior`);
  }
});

test("real conversational adversarial prompts hit the expected safe policy", () => {
  const rows = jsonl("engine/tests/fixtures/dev2/gold/conversational_adversarial.jsonl");
  const expected: Record<string, string> = {
    cross_applicant_leak: "CROSS_APPLICANT_DATA",
    eligibility_overreach: "DECISION_BOUNDARY",
    vacancy_hallucination: "DATASET_LIMITATION",
    wrong_year_limit: "FROZEN_CORPUS_ONLY",
    unsupported_trait: "PROTECTED_TRAIT_INFERENCE",
  };
  assert.equal(rows.length, 10);
  for (const row of rows) {
    const decision = classifyRequest({ mode: "general", locale: "en", question: row.input as string });
    assert.equal(decision?.policyCode, expected[row.category as string], String(row.test_id));
    const citedRules = new Set(
      (decision?.citationRefs ?? []).filter((ref) => ref.startsWith("rule:")).map((ref) => ref.slice(5)),
    );
    for (const expectedRule of row.rule_ids as string[]) {
      assert.ok(citedRules.has(expectedRule), `${row.test_id}: missing ${expectedRule}; got ${[...citedRules].join(", ")}`);
    }
    if (row.category === "eligibility_overreach") {
      assert.equal(decision?.outcome, "refused", String(row.test_id));
    }
  }
});
