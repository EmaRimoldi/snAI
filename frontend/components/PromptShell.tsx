"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

const TYPE_SPEED_MS = 55;
const DELETE_SPEED_MS = 32;
const FULL_PHRASE_PAUSE_MS = 1100;
const BETWEEN_PHRASES_PAUSE_MS = 250;

export default function PromptShell() {
  const { language, t, tList } = useI18n();
  const [value, setValue] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [placeholder, setPlaceholder] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const phraseIndexRef = useRef(0);
  const displayedTextRef = useRef("");
  const deletingRef = useRef(false);
  const hasValueRef = useRef(false);

  const sendDisabled = !value.trim() && attachedFiles.length === 0;

  const stopTypewriter = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const runTypewriter = useCallback(
    function run() {
      stopTypewriter();
      const phrases = tList("input.placeholders");

      if (hasValueRef.current) {
        setPlaceholder("");
        return;
      }

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setPlaceholder(phrases[0] ?? "");
        return;
      }

      const phrase = phrases[phraseIndexRef.current] ?? phrases[0] ?? "";
      let delay = TYPE_SPEED_MS;

      if (!deletingRef.current && displayedTextRef.current.length < phrase.length) {
        displayedTextRef.current = phrase.slice(0, displayedTextRef.current.length + 1);
      } else if (!deletingRef.current) {
        deletingRef.current = true;
        delay = FULL_PHRASE_PAUSE_MS;
      } else if (displayedTextRef.current.length > 0) {
        displayedTextRef.current = phrase.slice(0, displayedTextRef.current.length - 1);
        delay = DELETE_SPEED_MS;
      } else {
        deletingRef.current = false;
        phraseIndexRef.current = (phraseIndexRef.current + 1) % phrases.length;
        delay = BETWEEN_PHRASES_PAUSE_MS;
      }

      setPlaceholder(displayedTextRef.current);
      timerRef.current = window.setTimeout(run, delay);
    },
    [stopTypewriter, tList],
  );

  const restartTypewriter = useCallback(() => {
    stopTypewriter();
    phraseIndexRef.current = 0;
    displayedTextRef.current = "";
    deletingRef.current = false;
    setPlaceholder("");
    runTypewriter();
  }, [runTypewriter, stopTypewriter]);

  // (Re)start on mount and whenever the language changes; restart when
  // the user's reduced-motion preference changes.
  useEffect(() => {
    restartTypewriter();
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    query.addEventListener("change", restartTypewriter);
    return () => {
      query.removeEventListener("change", restartTypewriter);
      stopTypewriter();
    };
  }, [language, restartTypewriter, stopTypewriter]);

  const handleFiles = (files: FileList | null) => {
    const list = Array.from(files ?? []);
    console.log("Uploaded files:", list.map((file) => file.name));
    setAttachedFiles(list);
  };

  const attachmentText = attachedFiles.length
    ? t("input.attachmentStatus").replace("{count}", String(attachedFiles.length))
    : "";

  return (
    <section className="prompt-section" aria-label={t("input.sectionLabel")}>
      <div
        id="prompt-shell"
        className={isDragging ? "prompt-shell is-dragging" : "prompt-shell"}
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepthRef.current += 1;
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
          if (dragDepthRef.current === 0) setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepthRef.current = 0;
          setIsDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
      >
        <button
          id="upload-button"
          className="prompt-icon-button"
          type="button"
          aria-label={t("input.uploadLabel")}
          onClick={() => fileInputRef.current?.click()}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551" />
          </svg>
          <span id="file-badge" className="file-badge" hidden={attachedFiles.length === 0}>
            {attachedFiles.length ? String(attachedFiles.length) : ""}
          </span>
        </button>
        <input
          id="file-input"
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept="image/*,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          tabIndex={-1}
          onChange={(event) => handleFiles(event.target.files)}
        />
        <form
          id="prompt-form"
          className="prompt-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (sendDisabled) return;
            console.log("Submitted:", value.trim(), attachedFiles);
            setValue("");
            setAttachedFiles([]);
            if (fileInputRef.current) fileInputRef.current.value = "";
            hasValueRef.current = false;
            restartTypewriter();
          }}
        >
          <input
            id="prompt-input"
            className="prompt-input"
            type="text"
            aria-label={t("input.ariaLabel")}
            autoComplete="off"
            value={value}
            placeholder={placeholder}
            onChange={(event) => {
              const next = event.target.value;
              setValue(next);
              hasValueRef.current = Boolean(next);
              if (next) {
                stopTypewriter();
                setPlaceholder("");
              } else {
                restartTypewriter();
              }
            }}
          />
          <button
            id="send-button"
            className="send-button"
            type="submit"
            aria-label={t("input.sendLabel")}
            disabled={sendDisabled}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="m5 12 7-7 7 7" />
              <path d="M12 19V5" />
            </svg>
          </button>
        </form>
        <span id="attachment-status" className="visually-hidden" role="status" aria-live="polite">
          {attachmentText}
        </span>
      </div>
    </section>
  );
}
