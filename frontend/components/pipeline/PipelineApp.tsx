"use client";

// Signed-in experience: the Profile → Understand → Prepare pipeline over one
// application record. Self-contained (owns its state provider) so page.tsx only
// needs to mount it.

import type { RefObject } from "react";
import { useApp } from "@/lib/pipeline/state";
import { useCopy, fmt } from "@/lib/pipeline/copy";
import Stepper from "./Stepper";
import ProfileStep from "./ProfileStep";
import UnderstandStep from "./UnderstandStep";
import PrepareStep from "./PrepareStep";
import s from "./pipeline.module.css";

type Props = { headingRef?: RefObject<HTMLHeadingElement | null>; headingId?: string };

function PipelineInner({ headingRef, headingId }: Props) {
  const c = useCopy();
  const { step, deletionProof, clearDeletionProof } = useApp();

  return (
    <div className={s.shell}>
      <div>
        <h1 id={headingId} ref={headingRef} tabIndex={-1} className={s.title}>
          {c.appTitle}
        </h1>
        <p className={s.subtitle}>{c.appSubtitle}</p>
      </div>

      {/* Deletion proof — lives in the provider so it survives the wipe and
          the navigation back to Profile (demo step 6). */}
      {deletionProof && (
        <div className={s.proof} role="status">
          {fmt(c.deletedProof, {
            docs: deletionProof.documentsRemoved,
            fields: deletionProof.fieldsRemoved,
            at: deletionProof.at,
          })}{" "}
          <button type="button" className="secondary-button" onClick={clearDeletionProof}>
            {c.dismiss}
          </button>
        </div>
      )}

      <Stepper />

      {step === "profile" && <ProfileStep />}
      {step === "understand" && <UnderstandStep />}
      {step === "prepare" && <PrepareStep />}
    </div>
  );
}

// The state provider now lives in app/page.tsx (above SiteHeader) so the
// header status chips share the same application record.
// The floating chat launcher was removed — the rules chat lives as a full
// panel inside the Understand step instead.
export default function PipelineApp({ headingRef, headingId }: Props) {
  return <PipelineInner headingRef={headingRef} headingId={headingId} />;
}
