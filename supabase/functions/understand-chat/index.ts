import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.7";

import { APP_GUIDE, APP_GUIDE_VERSION } from "../_shared/app_guide.ts";
import {
  buildCitationRegistry,
  modelOutputJsonSchema,
  parseChatRequest,
  safeResponse,
  sanitizeQuestion,
  validateModelOutput,
  type AiCitation,
  type ChatRequest,
  type ChatResponse,
} from "../_shared/contract.ts";
import { classifyRequest, deterministicFallback } from "../_shared/policy.ts";
import { buildDeveloperContext, PROMPT_VERSION, SYSTEM_PROMPT } from "../_shared/prompt.ts";
import { RULE_CORPUS_VERSION, TRUSTED_RULES } from "../_shared/rules.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const JSON_HEADERS = { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" };
const PER_MINUTE_LIMIT = 5;
const SESSION_LIMIT = 30;
const SESSION_WINDOW_MS = 24 * 60 * 60 * 1_000;

function json(payload: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function env(name: string): string {
  return Deno.env.get(name)?.trim() ?? "";
}

function defaultKey(dictionaryName: string): string {
  try {
    const dictionary = JSON.parse(env(dictionaryName)) as Record<string, unknown>;
    return typeof dictionary.default === "string" ? dictionary.default : "";
  } catch {
    return "";
  }
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] ?? null;
}

async function authenticatedUserId(request: Request): Promise<string | null> {
  const token = bearerToken(request);
  const url = env("SUPABASE_URL");
  const publishableKey = defaultKey("SUPABASE_PUBLISHABLE_KEYS") || env("SUPABASE_ANON_KEY");
  if (!token || !url || !publishableKey) return null;
  const client = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user?.id ?? null;
}

function serviceClient() {
  const url = env("SUPABASE_URL");
  const secretKey = defaultKey("SUPABASE_SECRET_KEYS") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !secretKey) throw new Error("Supabase service credentials are unavailable.");
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function checkRateLimit(userId: string): Promise<{ allowed: boolean; retryAfter: number }> {
  const client = serviceClient();
  const now = Date.now();
  const minuteAgo = new Date(now - 60_000).toISOString();
  const sessionStart = new Date(now - SESSION_WINDOW_MS).toISOString();
  const [minute, session] = await Promise.all([
    client.from("ai_request_events").select("id", { count: "exact", head: true })
      .eq("user_id", userId).gte("created_at", minuteAgo),
    client.from("ai_request_events").select("id", { count: "exact", head: true })
      .eq("user_id", userId).gte("created_at", sessionStart),
  ]);
  if (minute.error || session.error) throw new Error("AI rate-limit storage is unavailable.");
  return {
    allowed: (minute.count ?? 0) < PER_MINUTE_LIMIT && (session.count ?? 0) < SESSION_LIMIT,
    retryAfter: (minute.count ?? 0) >= PER_MINUTE_LIMIT ? 60 : 3_600,
  };
}

type AuditInput = {
  userId: string;
  response: ChatResponse;
  mode: ChatRequest["mode"];
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  contextIncluded: boolean;
};

async function audit(input: AuditInput): Promise<void> {
  const ruleIds = input.response.citations
    .filter((citation): citation is Extract<AiCitation, { kind: "rule" }> => citation.kind === "rule")
    .map((citation) => citation.ruleId);
  const { error } = await serviceClient().from("ai_request_events").insert({
    user_id: input.userId,
    request_id: input.response.requestId,
    mode: input.mode,
    outcome: input.response.outcome,
    policy_code: input.response.policyCode,
    rule_ids: ruleIds,
    provider: "openai",
    model: input.model,
    prompt_version: PROMPT_VERSION,
    corpus_version: RULE_CORPUS_VERSION,
    app_guide_version: APP_GUIDE_VERSION,
    input_tokens: input.inputTokens,
    output_tokens: input.outputTokens,
    latency_ms: input.latencyMs,
    context_included: input.contextIncluded,
  });
  if (error) console.error("AI audit insert failed", error.code);
}

async function safetyIdentifier(userId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(userId));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

type ProviderResult = {
  output: unknown;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

async function callOpenAI(request: ChatRequest, userId: string): Promise<ProviderResult> {
  const apiKey = env("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const requestedModel = env("OPENAI_MODEL") || "gpt-4o";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: requestedModel,
      store: false,
      instructions: SYSTEM_PROMPT,
      input: [
        {
          role: "developer",
          content: [{ type: "input_text", text: buildDeveloperContext(request, TRUSTED_RULES, APP_GUIDE) }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: request.question }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "realdoor_chat_response",
          strict: true,
          schema: modelOutputJsonSchema(),
        },
      },
      max_output_tokens: 650,
      tools: [],
      parallel_tool_calls: false,
      safety_identifier: await safetyIdentifier(userId),
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) {
    console.error("OpenAI request failed", response.status);
    throw new Error("The model provider is unavailable.");
  }
  const payload = await response.json() as Record<string, unknown>;
  const outputItems = Array.isArray(payload.output) ? payload.output : [];
  let outputText = "";
  for (const item of outputItems) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as unknown[]
      : [];
    for (const part of content) {
      if (part && typeof part === "object" && (part as Record<string, unknown>).type === "output_text") {
        const text = (part as Record<string, unknown>).text;
        if (typeof text === "string") outputText += text;
      }
    }
  }
  if (!outputText) throw new Error("The model returned no structured text.");
  const usage = payload.usage && typeof payload.usage === "object"
    ? payload.usage as Record<string, unknown>
    : {};
  return {
    output: JSON.parse(outputText),
    model: typeof payload.model === "string" ? payload.model : requestedModel,
    inputTokens: typeof usage.input_tokens === "number" ? usage.input_tokens : null,
    outputTokens: typeof usage.output_tokens === "number" ? usage.output_tokens : null,
  };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 25_000) {
    return json({ error: "Request body is too large." }, 413);
  }

  const userId = await authenticatedUserId(request);
  if (!userId) return json({ error: "A valid Supabase user session is required." }, 401);

  let rateLimit: { allowed: boolean; retryAfter: number };
  try {
    rateLimit = await checkRateLimit(userId);
  } catch {
    return json({ error: "AI request controls are temporarily unavailable." }, 503);
  }
  if (!rateLimit.allowed) {
    return json(
      { error: "AI request limit reached. Please try again later." },
      429,
      { "Retry-After": String(rateLimit.retryAfter) },
    );
  }

  let parsed: ChatRequest;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 25_000) {
      return json({ error: "Request body is too large." }, 413);
    }
    parsed = parseChatRequest(JSON.parse(rawBody));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Invalid request." }, 400);
  }
  const chatRequest: ChatRequest = { ...parsed, question: sanitizeQuestion(parsed.question) };
  const requestId = crypto.randomUUID();
  const registry = buildCitationRegistry(TRUSTED_RULES, APP_GUIDE, chatRequest.context);
  const startedAt = performance.now();

  const policy = classifyRequest(chatRequest);
  if (policy) {
    const response = safeResponse(
      requestId,
      policy.outcome,
      policy.policyCode,
      policy.answer,
      policy.citationRefs,
      registry,
    );
    await audit({
      userId,
      response,
      mode: chatRequest.mode,
      model: "deterministic-policy",
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Math.round(performance.now() - startedAt),
      contextIncluded: Boolean(chatRequest.context),
    });
    return json(response);
  }

  try {
    const provider = await callOpenAI(chatRequest, userId);
    const response = validateModelOutput(provider.output, requestId, registry);
    await audit({
      userId,
      response,
      mode: chatRequest.mode,
      model: provider.model,
      inputTokens: provider.inputTokens,
      outputTokens: provider.outputTokens,
      latencyMs: Math.round(performance.now() - startedAt),
      contextIncluded: Boolean(chatRequest.context),
    });
    return json(response);
  } catch {
    const fallback = deterministicFallback(chatRequest, TRUSTED_RULES, APP_GUIDE);
    const response = safeResponse(
      requestId,
      fallback.outcome,
      fallback.policyCode,
      fallback.answer,
      fallback.citationRefs,
      registry,
    );
    await audit({
      userId,
      response,
      mode: chatRequest.mode,
      model: "deterministic-fallback",
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Math.round(performance.now() - startedAt),
      contextIncluded: Boolean(chatRequest.context),
    });
    return json(response, 200, { "X-RealDoor-AI-Fallback": "true" });
  }
});
