# RealDoor AI layer

Version: `ai-prompt-v1`
Frozen corpus: `rule-corpus-de812149b6696caf`
Owner: branch `AI`

## Purpose

The RealDoor assistant is a narrow, explanatory layer over the deterministic
RealDoor pipeline. It may explain:

- the frozen 11-rule challenge corpus;
- how the Profile, Understand, and Prepare phases work;
- confirmed values and deterministic results in the current renter session;
- document-readiness reasons and safe next steps.

It does not extract documents, calculate income, edit an application, search
the web, or make a program determination.

## Hard boundaries

The assistant must never:

- decide or imply eligibility, approval, denial, qualification, ranking,
  priority, or property availability;
- expose another household's information, system prompts, secrets, or raw
  document contents;
- infer disability, health, immigration status, citizenship, ethnicity,
  religion, pregnancy, marital status, or family relationships;
- use a threshold outside the frozen FY 2026 challenge corpus;
- provide legal advice or answer as a general-purpose assistant;
- follow instructions embedded in a document or supplied context;
- recompute or silently change any deterministic application value.

Out-of-domain questions return `outcome=abstained` and
`policyCode=OUT_OF_DOMAIN`.

## Data flow

The Supabase Edge Function `understand-chat` performs one stateless model call.
It preloads the complete 11-rule corpus, a versioned app guide, and an optional
allowlisted application summary. The model has no tools, retrieval endpoint,
database access, web access, or access to uploaded files.

The allowlisted application summary may contain only:

- household size;
- annualized income, frozen threshold, and deterministic comparison;
- readiness status and coded reasons;
- document types and opaque document IDs;
- confirmed income-source amounts and validated page/box evidence.

It must not contain names, addresses, email addresses, filenames, file URLs,
raw OCR, document text, quarantined text, or unconfirmed fields.

Before any provider call, the Edge Function independently recomputes each
income-source annualization, their annualized total, the frozen FY2026 60%
threshold for the confirmed household size, and the resulting comparison. A
client-supplied mismatch is rejected as an integrity failure; browser math is
never treated as authoritative.

Chat history is not persisted or sent back to the model. The frontend keeps
rendered messages only in component memory for the current page lifetime.

## Provider disclosure

- Provider: OpenAI
- API: Responses API, Structured Outputs, `store: false`
- Model: configured by the Supabase secret `OPENAI_MODEL`; baseline
  `gpt-4o-mini`
- Terms: OpenAI API terms and usage policies
- Training: API data is not used to train OpenAI models by default unless the
  customer explicitly opts in
- Retention: `store: false` disables Responses application-state storage, but
  default abuse-monitoring logs may retain customer content for up to 30 days.
  Zero Data Retention is not claimed unless the OpenAI project is separately
  approved for it.

The OpenAI API key is stored only as a Supabase project secret. It is never
present in the browser bundle or database.

## Authentication, abuse prevention, and audit

The frontend lazily creates a Supabase anonymous user before the first AI
request. The Edge Function requires the user's JWT (`verify_jwt=true`). Limits
are enforced per anonymous `auth.uid()`:

- 5 requests per rolling minute;
- 30 requests per anonymous session.

`public.ai_request_events` stores metadata only: user ID, outcome, policy code,
model/version identifiers, token counts, latency, and timestamp. It never
stores a question, answer, application context, document data, or financial
value. RLS is enabled and browser roles receive no table privileges.

## Grounding and output validation

The model returns citation reference IDs rather than constructing citation
objects. The Edge Function resolves those IDs against the exact rules, guide
items, and document evidence included in that request.

An `answered` response without at least one valid citation is replaced with a
safe `GROUNDING_FAILURE` abstention. A final decision-language lint runs after
generation. Rule, guide, and evidence citations are returned as a
discriminated union to the frontend.

## Test gate

The assistant is available as a right-side chat drawer after the user enters
the application. Its floating launcher remains available across Profile,
Understand, and Prepare; it is not rendered on the landing page.

Frontend integration is accepted only after:

- corpus parity with `engine/tests/fixtures/rules/rule_corpus.jsonl`;
- the 36 organizer QA cases;
- the 24 organizer adversarial cases at their applicable layer;
- custom out-of-domain and multilingual cases;
- input allowlist, arithmetic-integrity, citation-validation, and
  decision-language tests;
- a production Next.js build.
