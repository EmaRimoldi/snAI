"use client";

// Document + page + bounding box. Renders a page schematic with the field's
// normalized region highlighted (top-left origin, values in [0,1]), plus a link
// to open the real uploaded document. No PDF dependency needed.

import type { DocumentRecord, ExtractedField } from "@/lib/pipeline/types";
import { useCopy, fmt } from "@/lib/pipeline/copy";
import s from "./pipeline.module.css";

type Props = { doc: DocumentRecord | undefined; field: ExtractedField | undefined };

export default function DocumentPreview({ doc, field }: Props) {
  const c = useCopy();
  if (!doc) return null;

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
      <div className={s.page} role="img" aria-label={`${doc.fileName} — ${fmt(c.page, { n: field?.page ?? 1 })}`}>
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
