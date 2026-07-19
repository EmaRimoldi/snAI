"use client";

// Signed-in experience: the Profile → Understand → Prepare pipeline over one
// application record. Self-contained (owns its state provider) so page.tsx only
// needs to mount it.

import type { RefObject } from "react";
import { AppStateProvider, useApp } from "@/lib/pipeline/state";
import { useCopy } from "@/lib/pipeline/copy";
import GlobalValues from "./GlobalValues";
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

      <GlobalValues />
      <Stepper />

      {step === "profile" && <ProfileStep />}
      {step === "understand" && <UnderstandStep />}
      {step === "prepare" && <PrepareStep />}
    </div>
  );
}

export default function PipelineApp({ headingRef, headingId }: Props) {
  return (
    <AppStateProvider>
      <PipelineInner headingRef={headingRef} headingId={headingId} />
      <AiChatWidget />
    </AppStateProvider>
  );
}
