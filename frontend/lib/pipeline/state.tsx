"use client";

// The single reactive source of truth for the application record. Holds documents
// and extracted fields; derives Gross Income, Errors, readiness, and the missing-
// documents checklist after every change. Only confirmed/corrected values flow into
// the income math. Delete-session truly clears everything and returns a proof.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type {
  DisplayStatus,
  DocumentRecord,
  DocumentType,
  ExtractedField,
  ReadinessResult,
  Submission,
  Citation,
} from "@/lib/pipeline/types";
import {
  computeGrossAnnualCents,
  computeReadiness,
  computeErrorCount,
  compareToThreshold,
  countUnresolved,
  deriveDisplayStatus,
  thresholdCentsForSize,
  centsToDollars,
} from "@/lib/pipeline/calc";
import { processBatch } from "@/lib/engine/extract";

export type Step = "profile" | "understand" | "prepare";

/** Documents we prompt the renter to provide (uploaded vs still-missing checklist). */
export const REQUIRED_CHECKLIST: readonly DocumentType[] = [
  "application_summary",
  "pay_stub",
  "employment_letter",
];

export type DeletionProof = { documentsRemoved: number; fieldsRemoved: number; at: string };

type AppValue = {
  step: Step;
  stepUnlocked: Record<Step, boolean>;
  documents: DocumentRecord[];
  fields: ExtractedField[];
  busy: boolean;
  locked: boolean;
  applicationId: string;
  quarantineCount: number;
  // derived
  grossIncomeCents: number;
  errorCount: number;
  readiness: ReadinessResult;
  displayStatus: DisplayStatus;
  unresolvedCount: number;
  missingRequired: DocumentType[];
  presentTypes: DocumentType[];
  householdSize: number | null;
  householdSizeConfirmed: boolean;
  /** Field the header error menu asked to open in Profile (null = none). */
  pendingReviewFieldId: string | null;
  // actions
  goToStep: (step: Step) => void;
  requestReviewField: (id: string) => void;
  clearReviewRequest: () => void;
  setDocumentPageCount: (id: string, pageCount: number) => void;
  addFiles: (files: File[]) => Promise<DocumentRecord[]>;
  addManualField: (
    documentId: string,
    key: string,
    value: string,
    options?: { isIncome?: boolean; incomeFrequency?: ExtractedField["incomeFrequency"] },
  ) => void;
  confirmField: (id: string) => void;
  correctField: (id: string, value: string) => void;
  lock: () => void;
  unlock: () => void;
  deleteSession: () => DeletionProof;
  buildSubmission: () => Submission;
};

const AppContext = createContext<AppValue | null>(null);

const AUTOLOAD_HOUSEHOLD =
  process.env.NODE_ENV === "development" ? process.env.NEXT_PUBLIC_DEMO_HOUSEHOLD : undefined;
/** Debug: pretend earlier steps are done — auto-confirm every extracted field
 *  after the demo autoload and jump straight to this step ("understand" | "prepare"). */
const DEMO_STEP =
  process.env.NODE_ENV === "development" ? process.env.NEXT_PUBLIC_DEMO_STEP : undefined;

type DemoHouseholdResponse = {
  householdId: string;
  files: Array<{ name: string; type: string; contentBase64: string }>;
};

function shortId(): string {
  const uuid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "0000";
  return uuid.replace(/-/g, "").slice(0, 8).toUpperCase();
}

/** Household size comes ONLY from the documents (never inferred, never
 *  defaulted): null when absent/unreadable, which yields no frozen threshold. */
function readHouseholdSize(
  fields: readonly ExtractedField[],
): { size: number | null; confirmed: boolean } {
  const candidates = fields.filter((f) => f.key === "household_size");
  const confirmed = candidates.find((f) => f.reviewStatus === "confirmed" || f.reviewStatus === "corrected");
  const chosen = confirmed ?? candidates[0];
  const n = chosen ? parseInt(chosen.value, 10) : NaN;
  return { size: Number.isFinite(n) && n > 0 ? n : null, confirmed: Boolean(confirmed) };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<Step>("profile");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [fields, setFields] = useState<ExtractedField[]>([]);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pendingReviewFieldId, setPendingReviewFieldId] = useState<string | null>(null);
  const [understandVisited, setUnderstandVisited] = useState(false);

  const requestReviewField = useCallback((id: string) => {
    setStep("profile");
    setPendingReviewFieldId(id);
  }, []);
  const clearReviewRequest = useCallback(() => setPendingReviewFieldId(null), []);
  const applicationIdRef = useRef<string>(`APP-${shortId()}`);
  const demoStartedRef = useRef(false);

  // Sequential pipeline: Understand opens with the first upload, Prepare only
  // after the renter has actually passed through Understand.
  const stepUnlocked: Record<Step, boolean> = useMemo(() => {
    const understandOpen = documents.length > 0;
    return {
      profile: true,
      understand: understandOpen,
      prepare: understandOpen && understandVisited,
    };
  }, [documents.length, understandVisited]);

  const goToStep = useCallback(
    (next: Step) => {
      if (!stepUnlocked[next]) return;
      if (next === "understand") setUnderstandVisited(true);
      setStep(next);
    },
    [stepUnlocked],
  );

  // Keep one engine request for the whole upload batch. This prevents one
  // document from being silently dropped when several PDFs are selected.
  const addFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return [];
    setBusy(true);
    try {
      const inputs = files.map((file) => ({ id: `doc-${shortId()}`, file }));
      const results = await processBatch(inputs);
      const records: DocumentRecord[] = inputs.map(({ id, file }, index) => ({
        id,
        fileName: file.name,
        fileUrl: URL.createObjectURL(file),
        file,
        mimeType: file.type || "application/octet-stream",
        documentType: results[index].documentType,
        classifyConfidence: results[index].confidence,
        pageCount: 1,
        quarantinedText: results[index].quarantinedText,
        extractionError: results[index].extractionError,
      }));
      setDocuments((previous) => [...previous, ...records]);
      setFields((previous) => [...previous, ...results.flatMap((result) => result.fields)]);
      return records;
    } finally {
      setBusy(false);
    }
  }, []);

  const setDocumentPageCount = useCallback((id: string, pageCount: number) => {
    setDocuments((previous) =>
      previous.some((document) => document.id === id && document.pageCount !== pageCount)
        ? previous.map((document) =>
            document.id === id ? { ...document, pageCount } : document,
          )
        : previous,
    );
  }, []);

  useEffect(() => {
    if (!AUTOLOAD_HOUSEHOLD || demoStartedRef.current) return;
    demoStartedRef.current = true;
    let cancelled = false;

    const loadDemoHousehold = async () => {
      const response = await fetch("/api/dev-household", { cache: "no-store" });
      if (!response.ok) throw new Error(`Demo household request failed (${response.status})`);
      const payload = (await response.json()) as DemoHouseholdResponse;
      const files = payload.files.map(({ name, type, contentBase64 }) => {
        const binary = window.atob(contentBase64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
        }
        return new File([bytes.buffer], name, { type });
      });
      await addFiles(files);
      if (DEMO_STEP === "understand" || DEMO_STEP === "prepare") {
        // Debug shortcut: simulate a completed Profile step (all values
        // confirmed by the renter) and open the requested step directly.
        setFields((prev) =>
          prev.map((f) =>
            f.reviewStatus === "extracted" ? { ...f, reviewStatus: "confirmed" as const } : f,
          ),
        );
        setUnderstandVisited(true);
        setStep(DEMO_STEP);
      }
    };

    // Deferring one task avoids doing the expensive extraction twice during
    // React's development-only mount/cleanup/remount safety pass.
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      void loadDemoHousehold().catch((error: unknown) => {
        console.error("Could not auto-load HH-001:", error);
      });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      demoStartedRef.current = false;
    };
  }, [addFiles]);

  const addManualField = useCallback((
    documentId: string,
    key: string,
    value: string,
    options?: { isIncome?: boolean; incomeFrequency?: ExtractedField["incomeFrequency"] },
  ) => {
    const cleanValue = value.trim();
    if (!cleanValue) return;
    setFields((previous) => [
      ...previous,
      {
        id: `${documentId}:manual:${key}:${shortId()}`,
        documentId,
        key,
        value: cleanValue,
        page: 1,
        bbox: [0, 0, 0, 0],
        confidence: 1,
        reviewStatus: "renter_entered",
        isIncome: options?.isIncome,
        incomeFrequency: options?.incomeFrequency,
      },
    ]);
  }, []);

  const confirmField = useCallback((id: string) => {
    setFields((prev) =>
      prev.map((f) => (f.id === id && f.reviewStatus === "extracted" ? { ...f, reviewStatus: "confirmed" } : f)),
    );
  }, []);

  const correctField = useCallback((id: string, value: string) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, value, reviewStatus: "corrected" } : f)));
  }, []);

  const deleteSession = useCallback((): DeletionProof => {
    const proof: DeletionProof = {
      documentsRemoved: documents.length,
      fieldsRemoved: fields.length,
      at: new Date().toISOString(),
    };
    for (const doc of documents) {
      if (doc.fileUrl.startsWith("blob:")) URL.revokeObjectURL(doc.fileUrl);
    }
    setDocuments([]);
    setFields([]);
    setLocked(false);
    setUnderstandVisited(false);
    setStep("profile");
    return proof;
  }, [documents, fields]);

  const presentTypes = useMemo(
    () => Array.from(new Set(documents.map((d) => d.documentType))),
    [documents],
  );
  const missingRequired = useMemo(
    () => REQUIRED_CHECKLIST.filter((t) => !presentTypes.includes(t)),
    [presentTypes],
  );
  const grossIncomeCents = useMemo(
    () => computeGrossAnnualCents(documents, fields),
    [documents, fields],
  );
  const readiness = useMemo(
    () => computeReadiness(documents, fields, missingRequired),
    [documents, fields, missingRequired],
  );
  const errorCount = useMemo(() => computeErrorCount(readiness.reasons), [readiness.reasons]);
  const household = useMemo(() => readHouseholdSize(fields), [fields]);
  const quarantineCount = useMemo(
    () => documents.filter((d) => d.quarantinedText).length,
    [documents],
  );
  const unresolvedCount = useMemo(() => countUnresolved(fields), [fields]);
  const displayStatus = useMemo(
    () =>
      deriveDisplayStatus({
        documentCount: documents.length,
        busy,
        locked,
        unresolvedCount,
        reasons: readiness.reasons,
        missingRequiredCount: missingRequired.length,
      }),
    [documents.length, busy, locked, unresolvedCount, readiness.reasons, missingRequired.length],
  );

  const buildSubmission = useCallback((): Submission => {
    const thresholdCents = thresholdCentsForSize(household.size);
    const citations: Citation[] = fields
      .filter((f) => f.reviewStatus !== "extracted")
      .map((f) => {
        const doc = documents.find((d) => d.id === f.documentId);
        return {
          kind: "document" as const,
          documentId: f.documentId,
          fileName: doc?.fileName ?? "document",
          page: f.page,
          bbox: f.bbox,
        };
      });
    return {
      household_id: applicationIdRef.current,
      annualized_income: centsToDollars(grossIncomeCents),
      comparison: compareToThreshold(grossIncomeCents, thresholdCents),
      readiness_status: readiness.status,
      citations,
    };
  }, [documents, fields, grossIncomeCents, household.size, readiness.status]);

  const value: AppValue = useMemo(
    () => ({
      step,
      stepUnlocked,
      documents,
      fields,
      busy,
      locked,
      applicationId: applicationIdRef.current,
      quarantineCount,
      grossIncomeCents,
      errorCount,
      readiness,
      displayStatus,
      unresolvedCount,
      missingRequired,
      presentTypes,
      householdSize: household.size,
      householdSizeConfirmed: household.confirmed,
      pendingReviewFieldId,
      goToStep,
      requestReviewField,
      clearReviewRequest,
      setDocumentPageCount,
      addFiles,
      addManualField,
      confirmField,
      correctField,
      lock: () => setLocked(true),
      unlock: () => setLocked(false),
      deleteSession,
      buildSubmission,
    }),
    [
      step, stepUnlocked, documents, fields, busy, locked, quarantineCount, grossIncomeCents,
      errorCount, readiness, displayStatus, unresolvedCount, missingRequired, presentTypes,
      household.size, household.confirmed, pendingReviewFieldId,
      goToStep, addFiles, addManualField, confirmField, correctField, deleteSession, buildSubmission,
      requestReviewField, clearReviewRequest, setDocumentPageCount,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppStateProvider");
  return ctx;
}
