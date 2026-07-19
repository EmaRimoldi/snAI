"use client";

// Evidence pane for the current field: a real PDF viewer with every extracted
// box overlaid (active field highlighted, boxes clickable). Falls back to the
// page schematic for non-PDF uploads or if pdf.js fails, so the renter always
// sees where a value came from.

import { useEffect, useState } from "react";
import type { DocumentRecord, ExtractedField } from "@/lib/pipeline/types";
import { useCopy, fmt } from "@/lib/pipeline/copy";
import { useApp } from "@/lib/pipeline/state";
import PdfViewer from "./PdfViewer";
import s from "./pipeline.module.css";

type Props = {
  doc: DocumentRecord | undefined;
  field: ExtractedField | undefined;
  /** All fields of this document — every box is drawn, not just the active one. */
  fields?: ExtractedField[];
};

export default function DocumentPreview({ doc, field, fields = [] }: Props) {
  const c = useCopy();
  const { requestReviewField, setDocumentPageCount } = useApp();
  const [viewerFailed, setViewerFailed] = useState(false);

  useEffect(() => {
    setViewerFailed(false);
  }, [doc?.id]);

  if (!doc) return null;

  const isPdf =
    doc.mimeType === "application/pdf" || doc.fileName.toLowerCase().endsWith(".pdf");

  if (doc.file && isPdf && !viewerFailed) {
    return (
      <div className={s.previewPane}>
        <PdfViewer
          doc={doc}
          fields={fields}
          activeFieldId={field?.id}
          onSelectField={requestReviewField}
          onPageCount={setDocumentPageCount}
          onError={() => setViewerFailed(true)}
        />
        <a className={s.docLink} href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
          {c.openDocument} ↗
        </a>
      </div>
    );
  }

  const box = field?.bbox;
  const style = box
    ? {
        left: `${box[0] * 100}%`,
        top: `${box[1] * 100}%`,
        width: `${(box[2] - box[0]) * 100}%`,
        height: `${(box[3] - box[1]) * 100}%`,
      }
    : undefined;

  return (
    <div className={s.previewPane}>
      {viewerFailed && <p className={s.hint}>{c.previewError}</p>}
      <div
        className={s.page}
        role="img"
        aria-label={`${doc.fileName} — ${fmt(c.page, { n: field?.page ?? 1 })}`}
      >
        <span className={s.pageLabel}>{fmt(c.page, { n: field?.page ?? 1 })}</span>
        {box && (
          <span className={s.bbox} style={style} title={field?.value}>
            {field?.value}
          </span>
        )}
      </div>
      <a className={s.docLink} href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
        {c.openDocument} ↗
      </a>
    </div>
  );
}
