"use client";

// The single reactive source of truth for the application record. Holds documents
// and extracted fields; derives Gross Income, Errors, readiness, and the missing-
// documents checklist after every change. Only confirmed/corrected values flow into
// the income math. Delete-session truly clears everything and returns a proof.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type {
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
  thresholdCentsForSize,
  centsToDollars,
} from "@/lib/pipeline/calc";
import { classifyDocument, extractFields } from "@/lib/engine/extract";

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
  missingRequired: DocumentType[];
  presentTypes: DocumentType[];
  householdSize: number;
  householdSizeConfirmed: boolean;
  // actions
  goToStep: (step: Step) => void;
  addFiles: (files: File[]) => Promise<void>;
  confirmField: (id: string) => void;
  correctField: (id: string, value: string) => void;
  lock: () => void;
  unlock: () => void;
  deleteSession: () => DeletionProof;
  buildSubmission: () => Submission;
};

const AppContext = createContext<AppValue | null>(null);

function shortId(): string {
  const uuid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "0000";
  return uuid.replace(/-/g, "").slice(0, 8).toUpperCase();
}

function readHouseholdSize(fields: readonly ExtractedField[]): { size: number; confirmed: boolean } {
  const candidates = fields.filter((f) => f.key === "household_size");
  const confirmed = candidates.find((f) => f.reviewStatus === "confirmed" || f.reviewStatus === "corrected");
  const chosen = confirmed ?? candidates[0];
  const n = chosen ? parseInt(chosen.value, 10) : NaN;
  return { size: Number.isFinite(n) && n > 0 ? n : 1, confirmed: Boolean(confirmed) };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<Step>("profile");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [fields, setFields] = useState<ExtractedField[]>([]);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const applicationIdRef = useRef<string>(`APP-${shortId()}`);

  const addFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setBusy(true);
    try {
      for (const file of files) {
        const id = `doc-${shortId()}`;
        const { documentType, confidence } = await classifyDocument(file);
        const { fields: docFields, quarantinedText } = await extractFields({
          id,
          fileName: file.name,
          documentType,
        });
        const record: DocumentRecord = {
          id,
          fileName: file.name,
          fileUrl: URL.createObjectURL(file),
          mimeType: file.type || "application/octet-stream",
          documentType,
          classifyConfidence: confidence,
          pageCount: 1,
          quarantinedText,
        };
        setDocuments((prev) => [...prev, record]);
        setFields((prev) => [...prev, ...docFields]);
      }
    } finally {
      setBusy(false);
    }
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
  const grossIncomeCents = useMemo(() => computeGrossAnnualCents(fields), [fields]);
  const readiness = useMemo(
    () => computeReadiness(documents, fields, missingRequired),
    [documents, fields, missingRequired],
  );
  const errorCount = useMemo(
    () => computeErrorCount(fields, missingRequired),
    [fields, missingRequired],
  );
  const household = useMemo(() => readHouseholdSize(fields), [fields]);
  const quarantineCount = useMemo(
    () => documents.filter((d) => d.quarantinedText).length,
    [documents],
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
      documents,
      fields,
      busy,
      locked,
      applicationId: applicationIdRef.current,
      quarantineCount,
      grossIncomeCents,
      errorCount,
      readiness,
      missingRequired,
      presentTypes,
      householdSize: household.size,
      householdSizeConfirmed: household.confirmed,
      goToStep: setStep,
      addFiles,
      confirmField,
      correctField,
      lock: () => setLocked(true),
      unlock: () => setLocked(false),
      deleteSession,
      buildSubmission,
    }),
    [
      step, documents, fields, busy, locked, quarantineCount, grossIncomeCents, errorCount,
      readiness, missingRequired, presentTypes, household.size, household.confirmed,
      addFiles, confirmField, correctField, deleteSession, buildSubmission,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppStateProvider");
  return ctx;
}
