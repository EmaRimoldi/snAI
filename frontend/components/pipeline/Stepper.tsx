"use client";

import { useApp } from "@/lib/pipeline/state";
import type { Step } from "@/lib/pipeline/state";
import { useCopy } from "@/lib/pipeline/copy";
import s from "./pipeline.module.css";

function LockIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export default function Stepper() {
  const c = useCopy();
  const { step, stepUnlocked, goToStep } = useApp();
  const steps: { id: Step; label: string; info: string }[] = [
    { id: "profile", label: c.step1, info: c.step1Info },
    { id: "understand", label: c.step2, info: c.step2Info },
    { id: "prepare", label: c.step3, info: c.step3Info },
  ];
  const activeIndex = steps.findIndex((x) => x.id === step);

  return (
    <nav aria-label={c.appTitle}>
      <ol className={s.stepper}>
        {steps.map((x, i) => {
          const isActive = x.id === step;
          const isLocked = !stepUnlocked[x.id];
          const tipId = `step-tip-${x.id}`;
          const classes = [
            s.stepItem,
            isActive ? s.stepActive : "",
            i < activeIndex ? s.stepDone : "",
            isLocked ? s.stepLocked : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <li key={x.id} className={s.stepWrap}>
              <button
                type="button"
                className={classes}
                aria-current={isActive ? "step" : undefined}
                aria-disabled={isLocked || undefined}
                aria-describedby={tipId}
                onClick={() => goToStep(x.id)}
              >
                <span className={s.stepNum} aria-hidden="true">
                  {isLocked ? <LockIcon /> : i + 1}
                </span>
                {x.label}
                <span className={s.stepInfo} aria-hidden="true">
                  i
                </span>
              </button>
              <span role="tooltip" id={tipId} className={s.stepTip}>
                {x.info}
                {isLocked && ` — ${c.stepLockedNote}`}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
