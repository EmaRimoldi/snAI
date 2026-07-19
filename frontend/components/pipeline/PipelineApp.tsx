"use client";

// Signed-in experience: the Profile → Understand → Prepare pipeline over one
// application record. Self-contained (owns its state provider) so page.tsx only
// needs to mount it.

import type { RefObject } from "react";
import { useApp } from "@/lib/pipeline/state";
import { useCopy } from "@/lib/pipeline/copy";
import Stepper from "./Stepper";
import ProfileStep from "./ProfileStep";
import UnderstandStep from "./UnderstandStep";
import PrepareStep from "./PrepareStep";
import AiChatWidget from "@/components/ai/AiChatWidget";
import s from "./pipeline.module.css";

type Props = { headingRef?: RefObject<HTMLHeadingElement | null>; headingId?: string };

function PipelineInner({ headingRef, headingId }: Props) {
  const c = useCopy();
  const { step } = useApp();

  return (
    <div className={s.shell}>
      <div>
        <h1 id={headingId} ref={headingRef} tabIndex={-1} className={s.title}>
          {c.appTitle}
        </h1>
        <p className={s.subtitle}>{c.appSubtitle}</p>
      </div>

      <Stepper />

      {step === "profile" && <ProfileStep />}
      {step === "understand" && <UnderstandStep />}
      {step === "prepare" && <PrepareStep />}
    </div>
  );
}

// The state provider now lives in app/page.tsx (above SiteHeader) so the
// header status chips share the same application record.
export default function PipelineApp({ headingRef, headingId }: Props) {
  return (
    <>
      <PipelineInner headingRef={headingRef} headingId={headingId} />
      <AiChatWidget />
    </>
  );
}
