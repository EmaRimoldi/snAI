"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useCopy } from "@/lib/pipeline/copy";
import { useApp } from "@/lib/pipeline/state";
import { askRealDoor } from "@/lib/ai/client";
import { buildSafeUnderstandingContext } from "@/lib/ai/context";
import { localRulesFallback } from "@/lib/ai/fallback";
import type { AiChatResponse } from "@/lib/ai/types";
import AiAnswer from "@/components/ai/AiAnswer";
import s from "./AiChatWidget.module.css";

type ChatEntry =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; response: AiChatResponse; fallback: boolean };

export default function AiChatWidget() {
  const { language, t } = useI18n();
  const copy = useCopy();
  const {
    documents,
    fields,
    householdSize,
    householdSizeConfirmed,
    grossIncomeCents,
    missingRequired,
    readiness,
  } = useApp();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const nextId = useRef(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const context = useMemo(
    () => buildSafeUnderstandingContext({
      documents,
      fields,
      householdSize,
      householdSizeConfirmed,
      grossIncomeCents,
      missingRequired,
      readiness,
    }),
    [documents, fields, householdSize, householdSizeConfirmed, grossIncomeCents, missingRequired, readiness],
  );

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [entries, asking, open]);

  const newId = () => {
    const id = nextId.current;
    nextId.current += 1;
    return id;
  };

  const ask = async (raw: string) => {
    const question = raw.trim();
    if (!question || asking) return;
    setEntries((current) => [...current, { id: newId(), role: "user", text: question }]);
    setInput("");
    setAsking(true);

    let response: AiChatResponse;
    let fallback = false;
    try {
      response = await askRealDoor({
        mode: "personalized",
        locale: language,
        question,
        context,
      });
    } catch {
      response = localRulesFallback(question, { refusal: copy.refusal, abstain: copy.abstain });
      fallback = true;
    }
    setEntries((current) => [...current, { id: newId(), role: "assistant", response, fallback }]);
    setAsking(false);
  };

  const send = () => ask(input);

  return (
    <>
      {open && (
        <>
          <button
            type="button"
            className={s.backdrop}
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
          <aside id="ai-chat-panel" className={s.panel} role="dialog" aria-labelledby="ai-chat-title" data-testid="ai-chat-panel">
            <header className={s.header}>
              <h2 id="ai-chat-title">{t("aiChat.title")}</h2>
              <button
                type="button"
                className={s.closeButton}
                aria-label={t("aiChat.closeLabel")}
                onClick={() => setOpen(false)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </header>

            <div className={s.messages} aria-live="polite">
              {entries.length === 0 && (
                <div className={s.emptyState}>
                  <p>{t("aiChat.empty")}</p>
                </div>
              )}
              {entries.map((entry) => entry.role === "user" ? (
                <div key={entry.id} className={s.userMessage}>{entry.text}</div>
              ) : (
                <div key={entry.id} className={s.assistantMessage}>
                  {entry.fallback && <p className={s.fallback}>{t("aiChat.fallback")}</p>}
                  <AiAnswer response={entry.response} documents={documents} onSuggestion={(question) => void ask(question)} />
                </div>
              ))}
              {asking && <p className={s.thinking}>{t("aiChat.thinking")}</p>}
              <div ref={endRef} />
            </div>

            <footer className={s.footer}>
              <form
                className={s.composer}
                onSubmit={(event) => {
                  event.preventDefault();
                  void send();
                }}
              >
                <input
                  ref={inputRef}
                  value={input}
                  maxLength={1_000}
                  placeholder={t("aiChat.placeholder")}
                  aria-label={t("aiChat.placeholder")}
                  onChange={(event) => setInput(event.target.value)}
                />
                <button type="submit" aria-label={t("aiChat.sendLabel")} disabled={asking || !input.trim()}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m5 12 7-7 7 7M12 19V5" />
                  </svg>
                </button>
              </form>
              <p>{t("aiChat.privacy")}</p>
            </footer>
          </aside>
        </>
      )}

      {!open && (
        <button
          type="button"
          className={s.launcher}
          aria-label={t("aiChat.openLabel")}
          aria-expanded="false"
          aria-controls="ai-chat-panel"
          onClick={() => setOpen(true)}
          data-testid="ai-chat-launcher"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 15a4 4 0 0 1-4 4H9l-5 3v-7a4 4 0 0 1-1-2.7V8a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4Z" />
          </svg>
        </button>
      )}
    </>
  );
}
