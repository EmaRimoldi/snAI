import { supabase } from "@/lib/supabase";
import type { AiChatRequest, AiChatResponse, AiCitation } from "@/lib/ai/types";

let anonymousSignIn: Promise<void> | null = null;

async function ensureAiSession(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return;
  if (!anonymousSignIn) {
    anonymousSignIn = (async () => {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw new Error("Anonymous RealDoor sessions are not available yet.");
    })().finally(() => {
      anonymousSignIn = null;
    });
  }
  await anonymousSignIn;
}
function citation(value: unknown): value is AiCitation {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return item.kind === "rule" || item.kind === "guide" || item.kind === "document";
}

function parseResponse(value: unknown): AiChatResponse {
  if (!value || typeof value !== "object") throw new Error("RealDoor returned an invalid AI response.");
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.requestId !== "string" ||
    typeof raw.outcome !== "string" ||
    typeof raw.policyCode !== "string" ||
    typeof raw.answer !== "string" ||
    !Array.isArray(raw.citations)
  ) {
    throw new Error("RealDoor returned an invalid AI response.");
  }
  return {
    requestId: raw.requestId,
    outcome: raw.outcome as AiChatResponse["outcome"],
    policyCode: raw.policyCode,
    answer: raw.answer,
    citations: raw.citations.filter(citation),
  };
}

// Dev-only override: point the chat at a locally-served understand-chat
// (same shared modules, no Supabase auth). Unset in production builds.
const LOCAL_AI_URL = process.env.NEXT_PUBLIC_AI_URL;

export async function askRealDoor(request: AiChatRequest): Promise<AiChatResponse> {
  if (LOCAL_AI_URL) {
    const response = await fetch(LOCAL_AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error("RealDoor couldn't reach the AI guide. Please try again.");
    return parseResponse(await response.json());
  }
  await ensureAiSession();
  const { data, error } = await supabase.functions.invoke("understand-chat", { body: request });
  if (error) {
    const status = "context" in error && error.context instanceof Response ? error.context.status : 0;
    if (status === 429) throw new Error("You've reached the temporary AI request limit. Please try again shortly.");
    throw new Error("RealDoor couldn't reach the AI guide. Please try again.");
  }
  return parseResponse(data);
}
